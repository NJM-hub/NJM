import "server-only";
import type pg from "pg";
import {
  CONTRACT_STATUS,
  EFFECTIVE_STATUS,
  EXPENSE_CATEGORIES,
  OWNER_TYPES,
  PAYMENT_METHODS,
  PROPERTY_TYPES,
  RATE_TYPES,
  REPAYMENT_TYPES,
} from "@/lib/constants";
import { reallocateContract } from "@/lib/data";
import { q, q1 } from "@/lib/db";
import { monthStart, todayKST } from "@/lib/dates";
import { cellDate, cellMoney, cellNumber, cellText, reverseLabel, type Cell, type ImportKind } from "@/lib/excel";
import { phoneDigits } from "@/lib/format";

export type ImportResult = { created: number; updated: number; skipped: { row: number; reason: string }[] };

type Row = Record<string, Cell>;

export async function nextContractNo(c: pg.PoolClient | null, year = todayKST().slice(0, 4)): Promise<string> {
  const r = await q1<{ n: number }>(
    "select coalesce(max(nullif(regexp_replace(contract_no, '^RC-\\d{4}-', ''), '')::int), 0) as n from contracts where contract_no ~ $1",
    [`^RC-${year}-\\d+$`],
    c ?? undefined,
  );
  return `RC-${year}-${String((r?.n ?? 0) + 1).padStart(3, "0")}`;
}

async function findProperty(c: pg.PoolClient, name: string | null) {
  if (!name) return null;
  return q1<{ id: string }>("select id from properties where name = $1 order by created_at limit 1", [name], c);
}

async function findUnit(c: pg.PoolClient, propertyId: string, unitNo: string | null, dong: string | null) {
  if (!unitNo) return null;
  return q1<{ id: string }>(
    "select id from units where property_id = $1 and unit_no = $2 and coalesce(dong,'') = coalesce($3,'') limit 1",
    [propertyId, unitNo, dong],
    c,
  );
}

async function findOrCreateTenant(c: pg.PoolClient, name: string, phone: string | null) {
  const digits = phoneDigits(phone);
  const hit = await q1<{ id: string }>(
    "select id from tenants where name = $1 and ($2 = '' or regexp_replace(coalesce(phone,''), '\\D', '', 'g') = $2) order by created_at limit 1",
    [name, digits],
    c,
  );
  if (hit) return { id: hit.id, created: false };
  const t = await q1<{ id: string }>("insert into tenants (name, phone) values ($1, $2) returning id", [name, phone], c);
  return { id: t!.id, created: true };
}

export async function importRows(kind: ImportKind, rows: Row[], c: pg.PoolClient): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: [] };
  const skip = (i: number, reason: string) => res.skipped.push({ row: i + 2, reason });
  const touchedContracts = new Set<string>();

  for (const [i, r] of rows.entries()) {
    await c.query("savepoint r");
    try {
      switch (kind) {
        case "properties": {
          const name = cellText(r["부동산명"]);
          if (!name) {
            skip(i, "부동산명 없음");
            break;
          }
          let ownerId: string | null = null;
          const ownerName = cellText(r["소유주"]);
          if (ownerName) {
            const o = await q1<{ id: string }>("select id from owners where name = $1 limit 1", [ownerName], c);
            ownerId =
              o?.id ??
              (await q1<{ id: string }>("insert into owners (name, owner_type) values ($1, $2) returning id", [
                ownerName,
                reverseLabel(OWNER_TYPES, r["소유구분"]) ?? "individual",
              ], c))!.id;
          }
          const vals = [
            ownerId,
            name,
            cellText(r["주소"]),
            cellText(r["건물명"]),
            reverseLabel(PROPERTY_TYPES, r["종류"]) ?? "etc",
            cellDate(r["매입일"]),
            cellMoney(r["매입가격"]) ?? 0,
            cellMoney(r["현재예상가"]),
            cellMoney(r["취득비용"]) ?? 0,
            cellMoney(r["리모델링비용"]) ?? 0,
            cellMoney(r["기타투자금"]) ?? 0,
          ];
          let p = await findProperty(c, name);
          if (p) {
            await q(
              `update properties set owner_id = coalesce($1, owner_id), name = $2, address = coalesce($3, address), building_name = coalesce($4, building_name),
                property_type = $5, purchase_date = coalesce($6, purchase_date), purchase_price = $7, current_value = coalesce($8, current_value),
                acquisition_cost = $9, remodeling_cost = $10, other_investment = $11, updated_at = now() where id = $12`,
              [...vals, p.id],
              c,
            );
          } else {
            p = await q1<{ id: string }>(
              `insert into properties (owner_id, name, address, building_name, property_type, purchase_date, purchase_price, current_value,
                acquisition_cost, remodeling_cost, other_investment) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
              vals,
              c,
            );
            res.created++;
          }
          const unitNo = cellText(r["호실"]);
          if (unitNo) {
            const dong = cellText(r["동"]);
            const u = await findUnit(c, p!.id, unitNo, dong);
            const uv = [cellText(r["층"]), cellNumber(r["면적(㎡)"]), cellMoney(r["예상보증금"]) ?? 0, cellMoney(r["예상월세"]) ?? 0, cellDate(r["공실시작일"])];
            if (u) {
              await q("update units set floor = $1, area_m2 = $2, expected_deposit = $3, expected_rent = $4, vacant_since = $5 where id = $6", [...uv, u.id], c);
              res.updated++;
            } else {
              await q(
                "insert into units (property_id, dong, unit_no, floor, area_m2, expected_deposit, expected_rent, vacant_since) values ($1,$2,$3,$4,$5,$6,$7,$8)",
                [p!.id, dong, unitNo, ...uv],
                c,
              );
              res.created++;
            }
          }
          break;
        }
        case "tenants": {
          const name = cellText(r["이름"]);
          if (!name) {
            skip(i, "이름 없음");
            break;
          }
          const t = await findOrCreateTenant(c, name, cellText(r["연락처"]));
          await q(
            "update tenants set biz_no = coalesce($2, biz_no), email = coalesce($3, email), memo = coalesce($4, memo) where id = $1",
            [t.id, cellText(r["사업자등록번호"]), cellText(r["이메일"]), cellText(r["메모"])],
            c,
          );
          if (t.created) res.created++;
          else res.updated++;
          break;
        }
        case "contracts": {
          const p = await findProperty(c, cellText(r["부동산명"]));
          if (!p) {
            skip(i, `부동산 '${cellText(r["부동산명"]) ?? ""}' 을(를) 찾을 수 없음 (부동산·호실을 먼저 가져오세요)`);
            break;
          }
          const u = await findUnit(c, p.id, cellText(r["호실"]), cellText(r["동"]));
          if (!u) {
            skip(i, `호실 '${cellText(r["호실"]) ?? ""}' 없음`);
            break;
          }
          const tenantName = cellText(r["임차인"]);
          const start = cellDate(r["시작일"]);
          const end = cellDate(r["종료일"]);
          if (!tenantName || !start || !end) {
            skip(i, "임차인·시작일·종료일은 꼭 필요합니다");
            break;
          }
          if (end < start) {
            skip(i, "종료일이 시작일보다 빠름");
            break;
          }
          const t = await findOrCreateTenant(c, tenantName, cellText(r["연락처"]));
          const statusText = cellText(r["상태"]);
          const effective = reverseLabel(EFFECTIVE_STATUS, statusText);
          const status =
            reverseLabel(CONTRACT_STATUS, statusText) ??
            (effective === "expiring" ? "active" : effective) ??
            (end < todayKST() ? "expired" : start > todayKST() ? "planned" : "active");
          const no = cellText(r["계약번호"]) ?? (await nextContractNo(c));
          const deposit = cellMoney(r["보증금"]) ?? 0;
          // 과거부터 이어진 계약은 이번 달부터 청구 (지난 달 미납이 한꺼번에 생기지 않도록)
          const billingFrom = cellDate(r["청구시작월"]) ?? (start < monthStart(todayKST()) ? monthStart(todayKST()) : null);
          const vals = [
            no, u.id, t.id, cellText(r["임대인"]), cellDate(r["계약일"]), start, end, deposit, cellMoney(r["월세"]) ?? 0,
            cellMoney(r["관리비"]) ?? 0, cellMoney(r["부가세"]) ?? 0, Math.min(31, Math.max(1, cellNumber(r["납부일"]) ?? 25)),
            billingFrom, status, cellText(r["특약사항"]),
          ];
          const existing = await q1<{ id: string }>("select id from contracts where contract_no = $1", [no], c);
          let id: string;
          if (existing) {
            await q(
              `update contracts set unit_id=$2, tenant_id=$3, landlord_name=$4, contract_date=$5, start_date=$6, end_date=$7, deposit=$8,
                monthly_rent=$9, maintenance_fee=$10, vat_amount=$11, pay_day=$12, billing_from=$13, status=$14, special_terms=$15, updated_at=now()
               where contract_no = $1`,
              vals,
              c,
            );
            id = existing.id;
            res.updated++;
          } else {
            id = (await q1<{ id: string }>(
              `insert into contracts (contract_no, unit_id, tenant_id, landlord_name, contract_date, start_date, end_date, deposit, monthly_rent,
                maintenance_fee, vat_amount, pay_day, billing_from, status, special_terms) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
              vals,
              c,
            ))!.id;
            res.created++;
          }
          await q(
            `insert into deposits (contract_id, amount, received_amount, received_date, return_due_date) values ($1,$2,$2,$3,$4)
             on conflict (contract_id) do update set amount = excluded.amount, return_due_date = excluded.return_due_date`,
            [id, deposit, status === "planned" ? null : start, end],
            c,
          );
          break;
        }
        case "payments": {
          const no = cellText(r["계약번호"]);
          const ct = no ? await q1<{ id: string; pay_day: number }>("select id, pay_day from contracts where contract_no = $1", [no], c) : null;
          const date = cellDate(r["입금일"]);
          const amount = cellMoney(r["입금액"]);
          if (!ct || !date || !amount || amount <= 0) {
            skip(i, !ct ? `계약번호 '${no ?? ""}' 없음` : "입금일·입금액 확인");
            break;
          }
          const month = cellDate(r["청구월"]);
          const ch = month
            ? await q1<{ id: string }>("select id from rent_charges where contract_id = $1 and billing_month = $2", [ct.id, monthStart(month)], c)
            : null;
          await q(
            "insert into payments (contract_id, charge_id, paid_date, amount, method, memo) values ($1,$2,$3,$4,$5,$6)",
            [ct.id, ch?.id ?? null, date, amount, reverseLabel(PAYMENT_METHODS, r["입금방법"]) ?? "transfer", cellText(r["메모"])],
            c,
          );
          touchedContracts.add(ct.id);
          res.created++;
          break;
        }
        case "loans": {
          const p = await findProperty(c, cellText(r["부동산명"]));
          const lender = cellText(r["금융기관"]);
          if (!p || !lender) {
            skip(i, !p ? "부동산을 찾을 수 없음" : "금융기관 없음");
            break;
          }
          const principal = cellMoney(r["대출원금"]) ?? 0;
          await q(
            `insert into loans (property_id, lender, product, start_date, principal, balance, interest_rate, rate_type, repayment_type,
               monthly_payment, interest_day, maturity_date) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              p.id, lender, cellText(r["대출상품"]), cellDate(r["실행일"]), principal, cellMoney(r["현재잔액"]) ?? principal,
              cellNumber(r["금리(%)"]) ?? 0, reverseLabel(RATE_TYPES, r["금리구분"]) ?? "variable",
              reverseLabel(REPAYMENT_TYPES, r["상환방식"]) ?? "bullet", cellMoney(r["월상환금"]), cellNumber(r["이자납부일"]), cellDate(r["만기일"]),
            ],
            c,
          );
          res.created++;
          break;
        }
        case "expenses": {
          const date = cellDate(r["일자"]);
          const amount = cellMoney(r["금액"]);
          const category = reverseLabel(EXPENSE_CATEGORIES, r["구분"]) ?? "etc";
          if (!date || amount == null) {
            skip(i, "일자·금액 확인");
            break;
          }
          const pname = cellText(r["부동산명"]);
          const p = pname && pname !== "(공통)" ? await findProperty(c, pname) : null;
          if (pname && pname !== "(공통)" && !p) {
            skip(i, `부동산 '${pname}' 없음`);
            break;
          }
          await q("insert into expenses (property_id, expense_date, category, amount, vendor, memo) values ($1,$2,$3,$4,$5,$6)", [
            p?.id ?? null, date, category, amount, cellText(r["거래처"]), cellText(r["메모"]),
          ], c);
          res.created++;
          break;
        }
      }
      await c.query("release savepoint r");
    } catch (e) {
      await c.query("rollback to savepoint r");
      skip(i, e instanceof Error ? e.message : String(e));
    }
  }
  for (const id of touchedContracts) await reallocateContract(id, c);
  return res;
}
