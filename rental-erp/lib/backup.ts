// 전체 백업 / 복원 (관리자)
//   백업 파일 = 임대 데이터 전 테이블을 JSON 으로 담아 gzip 으로 압축한 것 (.json.gz)
//   - 사용자 계정(비밀번호)·알림·변경 이력은 넣지 않는다 (계정은 그대로 두고, 알림은 다시 만들어진다)
//   - 문서 파일(PDF·사진)은 크기가 커서 넣지 않는다. 복원할 때 지금 DB 에 있는 문서는 그대로 남긴다
import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type pg from "pg";
import { q } from "@/lib/db";

export const BACKUP_APP = "rental-erp";
export const BACKUP_VERSION = 1;

/** 넣는 순서 (참조되는 테이블 먼저) */
export const BACKUP_TABLES = [
  "owners",
  "properties",
  "units",
  "tenants",
  "contracts",
  "deposits",
  "rent_charges",
  "payments",
  "payment_allocations",
  "loans",
  "loan_transactions",
  "expenses",
  "settings",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_LABELS: Record<BackupTable, string> = {
  owners: "소유주",
  properties: "부동산",
  units: "호실",
  tenants: "임차인",
  contracts: "계약",
  deposits: "보증금",
  rent_charges: "월세 청구",
  payments: "입금",
  payment_allocations: "입금 배분",
  loans: "대출",
  loan_transactions: "대출 거래",
  expenses: "비용",
  settings: "설정",
};

export type BackupFile = {
  app: typeof BACKUP_APP;
  version: number;
  created_at: string;
  counts: Record<string, number>;
  tables: Record<BackupTable, Record<string, unknown>[]>;
};

/** 지금 DB 내용을 백업 파일(gzip)로 */
export async function createBackup(): Promise<{ buf: Buffer; counts: Record<string, number> }> {
  const tables = {} as BackupFile["tables"];
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await q(`select * from ${t}`);
    counts[t] = tables[t].length;
  }
  const file: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, created_at: new Date().toISOString(), counts, tables };
  return { buf: gzipSync(JSON.stringify(file)), counts };
}

/** 올린 파일(.json.gz 또는 .json)을 읽고 형식 확인 */
export function parseBackup(raw: Buffer): BackupFile {
  let text: string;
  try {
    text = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8");
  } catch {
    throw new Error("백업 파일을 풀 수 없습니다. 이 프로그램에서 받은 백업 파일(.json.gz)인지 확인하세요.");
  }
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("백업 파일 내용이 올바르지 않습니다.");
  }
  if (file?.app !== BACKUP_APP || typeof file.tables !== "object" || !file.tables) throw new Error("이 프로그램의 백업 파일이 아닙니다.");
  if (file.version > BACKUP_VERSION) throw new Error("더 새로운 버전에서 만든 백업입니다. 프로그램을 업데이트한 뒤 복원하세요.");
  for (const t of BACKUP_TABLES) {
    if (!Array.isArray(file.tables[t])) throw new Error(`백업 파일에 '${BACKUP_LABELS[t]}' 자료가 없습니다.`);
  }
  return file;
}

/**
 * 백업 내용으로 되돌린다 (트랜잭션 안에서 호출).
 * 임대 데이터를 모두 지우고 백업 내용을 넣는다. 사용자 계정은 그대로, 문서 파일은 지금 것을 남긴다.
 */
export async function restoreBackup(file: BackupFile, c: pg.PoolClient): Promise<Record<string, number>> {
  // 문서는 백업에 없으므로 따로 보관했다가 다시 넣는다 (부동산을 지우면 같이 지워지기 때문)
  await c.query("create temp table _keep_documents on commit drop as select * from documents");
  await c.query(
    `truncate notification_deliveries, notifications, documents, payment_allocations, payments, rent_charges, deposits,
       loan_transactions, expenses, loans, contracts, tenants, units, properties, owners restart identity cascade`,
  );
  await c.query("delete from settings");

  const users = new Set((await c.query<{ id: string }>("select id from users")).rows.map((r) => r.id));
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    const rows = file.tables[t].map((r) =>
      // 입금 등록자가 지금 없는 계정이면 비운다
      t === "payments" && r.created_by && !users.has(String(r.created_by)) ? { ...r, created_by: null } : r,
    );
    for (let i = 0; i < rows.length; i += 500) {
      await c.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t}, $1::jsonb)`, [JSON.stringify(rows.slice(i, i + 500))]);
    }
    counts[t] = rows.length;
  }

  // 문서 다시 넣기: 연결된 부동산이 백업에 없으면 문서도 뺀다(원래 부동산 삭제 시 같이 지워지는 것과 같음), 나머지 연결은 없으면 비운다
  const kept = await c.query(
    `insert into documents (id, property_id, unit_id, contract_id, tenant_id, loan_id, category, title, file_name, mime_type, size_bytes, data, uploaded_by, created_at)
       select d.id, d.property_id,
              case when exists (select 1 from units x where x.id = d.unit_id) then d.unit_id end,
              case when exists (select 1 from contracts x where x.id = d.contract_id) then d.contract_id end,
              case when exists (select 1 from tenants x where x.id = d.tenant_id) then d.tenant_id end,
              case when exists (select 1 from loans x where x.id = d.loan_id) then d.loan_id end,
              d.category, d.title, d.file_name, d.mime_type, d.size_bytes, d.data, d.uploaded_by, d.created_at
         from _keep_documents d
        where d.property_id is null or exists (select 1 from properties x where x.id = d.property_id)`,
  );
  counts.documents_kept = kept.rowCount ?? 0;
  return counts;
}
