import Link from "next/link";
import { restoreBackupAction } from "@/app/actions/backup";
import RestoreForm from "@/components/RestoreForm";
import { Card, Empty, Notice, PageHeader, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { BACKUP_LABELS, BACKUP_TABLES } from "@/lib/backup";
import { q } from "@/lib/db";
import { num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const { can } = await requirePage();
  if (!can.admin) {
    return (
      <div className="space-y-4">
        <PageHeader title="💾 백업" />
        <Notice tone="yellow">백업 받기와 복원은 관리자만 할 수 있습니다.</Notice>
      </div>
    );
  }

  const counts = await Promise.all(BACKUP_TABLES.map(async (t) => (await q<{ n: number }>(`select count(*)::int as n from ${t}`))[0].n));
  const docs = (await q<{ n: number; bytes: number }>("select count(*)::int as n, coalesce(sum(size_bytes), 0)::bigint as bytes from documents"))[0];
  const history = await q<{ action: string; created_at: Date; detail: { created_at?: string } | null; name: string | null }>(
    `select a.action, a.created_at, a.detail, u.name from audit_logs a left join users u on u.id = a.actor_id
      where a.entity = 'backup' order by a.created_at desc limit 10`,
  );
  const daysSince = (
    await q<{ days: number | null }>("select (current_date - max(created_at)::date)::int as days from audit_logs where entity = 'backup' and action = 'download'")
  )[0].days;
  const fmt = (d: Date) => new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <PageHeader title="💾 백업" desc="모든 임대 데이터를 파일 하나로 받아 두고, 문제가 생기면 그 파일로 되돌립니다." />
      {daysSince === null ? (
        <Notice tone="orange">아직 백업을 받은 적이 없습니다. 지금 한 번 받아 두세요.</Notice>
      ) : daysSince >= 30 ? (
        <Notice tone="orange">마지막 백업이 {daysSince}일 전입니다. 새로 받아 두는 것을 권장합니다.</Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="① 백업 받기">
          <p className="text-sm text-slate-600">
            부동산·호실·임차인·계약·입금·청구·보증금·대출·비용·설정을 모두 담은 백업 파일(<b>.json.gz</b>)을 내려받습니다. 컴퓨터나 USB, 클라우드(구글 드라이브 등)에 보관하세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/api/backup" className="btn">
              ⬇ 백업 파일 받기
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 파일 다운로드 */}
            <a href="/api/export/all" className="btn-secondary">
              ⬇ 엑셀로도 받기 (보기용)
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            · 문서관리에 올린 파일(PDF·사진)은 크기가 커서 백업 파일에 들어가지 않습니다. 원본은 따로 보관하세요.
            <br />· 엑셀 파일은 눈으로 확인하는 용도이고, 되돌리기(복원)는 백업 파일(.json.gz)로 합니다.
          </p>
        </Card>

        <Card title="지금 저장된 데이터">
          <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-4">
            {BACKUP_TABLES.filter((t) => t !== "settings" && t !== "payment_allocations").map((t) => (
              <div key={t} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{BACKUP_LABELS[t]}</div>
                <div className="font-semibold tabular-nums">{num(counts[BACKUP_TABLES.indexOf(t)])}건</div>
              </div>
            ))}
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">문서 (백업 제외)</div>
              <div className="font-semibold tabular-nums">{num(docs.n)}건</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="② 백업에서 복원 (되돌리기)">
        <Notice tone="red">
          복원하면 <b>지금 데이터가 모두 지워지고</b> 백업 파일을 받은 시점의 내용으로 바뀝니다. 그 뒤에 입력한 내용은 사라지니, 복원 전에 지금 상태도 ① 에서 한 번 받아 두세요. (사용자 계정과 문서관리 파일은 그대로 남습니다)
        </Notice>
        <div className="mt-3">
          <RestoreForm action={restoreBackupAction} />
        </div>
      </Card>

      <Card title="백업 기록">
        {history.length === 0 ? (
          <Empty>기록이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>일시</th>
                <th>내용</th>
                <th>담당자</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{fmt(h.created_at)}</td>
                  <td>{h.action === "download" ? "백업 받기" : `복원 (${h.detail?.created_at?.slice(0, 10) ?? "?"} 백업)`}</td>
                  <td>{h.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-2 text-xs text-slate-500">
          엑셀로 기존 자료를 옮기려면 <Link href="/reports?tab=excel" className="link">통계/리포트 → 엑셀</Link> 을 이용하세요.
        </p>
      </Card>
    </div>
  );
}
