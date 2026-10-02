import Link from "next/link";
import { runDailyAction } from "@/app/actions/settings";
import ActionButton from "@/components/ActionButton";
import { Badge, Card, Empty, PageHeader, type Tone } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { NOTIFICATION_KINDS, label } from "@/lib/constants";
import { q } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { runDaily } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const SEV: Record<string, [string, Tone]> = { critical: ["🔴", "red"], warning: ["🟠", "orange"], caution: ["🟡", "yellow"], info: ["🔵", "blue"] };

export default async function NotificationsPage() {
  await requirePage();
  await runDaily().catch(() => null); // 화면을 열 때 새 알림 만들기 (같은 알림은 한 번만)
  const rows = await q<{ id: string; kind: string; severity: string; title: string; body: string | null; ref_type: string | null; ref_id: string | null; due_date: string | null; created_at: string; deliveries: number }>(
    `select n.*, n.created_at::text, (select count(*)::int from notification_deliveries d where d.notification_id = n.id) as deliveries
     from notifications n order by n.created_at desc, n.severity limit 200`,
  );
  const href = (r: (typeof rows)[number]) =>
    r.ref_type === "contract" ? `/contracts/${r.ref_id}` : r.ref_type === "loan" ? `/loans/${r.ref_id}` : r.ref_type === "charge" ? "/payments?view=today" : "/properties?filter=vacant";
  return (
    <div className="space-y-4">
      <PageHeader
        title="🔔 알림"
        desc="월세 납부일 · 미납 · 계약 만료(90/60/30/7일 전) · 보증금 반환 · 대출 만기 · 대출이자 납부 · 공실 발생"
        actions={
          <>
            <ActionButton action={runDailyAction}>지금 새로 만들기</ActionButton>
            <Link href="/settings?tab=notify" className="btn-secondary">문자·카톡·이메일 설정</Link>
          </>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <Empty>알림이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="py-2.5">
                <Link href={href(r)} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {SEV[r.severity]?.[0]} {r.title}
                    </div>
                    <div className="text-xs text-slate-500">{r.body}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={SEV[r.severity]?.[1] ?? "gray"}>{label(NOTIFICATION_KINDS, r.kind)}</Badge>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {fmtDate(r.created_at.slice(0, 10))}
                      {r.deliveries ? ` · 발송 ${r.deliveries}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
