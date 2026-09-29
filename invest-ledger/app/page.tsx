import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { listInvestments } from "@/lib/queries";

export const dynamic = "force-dynamic";

// 1단계용 간단 요약. 3단계에서 전체 대시보드(오늘/내일/7일/연체 금액, 만기 알림)로 확장합니다.
export default async function HomePage() {
  const rows = await listInvestments();
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);

  const principal = sum((r) => r.principal);
  const expected = sum((r) => r.expected_total);
  const collected = sum((r) => r.collected_amount);
  const active = rows.filter((r) => r.status === "active").length;
  const completed = rows.filter((r) => r.status === "completed").length;

  return (
    <>
      <PageHeader
        title="홈"
        description={`오늘 ${ymd(todayKst())} · 취소 건을 제외한 전체 투자 기준`}
        actions={<Link href="/investments/new" className="btn">+ 투자 등록</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="navy" label="총 투자 실행금액" value={won(principal)} sub={`${rows.length}건`} />
        <StatCard label="총 회수 예정금액" value={won(expected)} />
        <StatCard label="총 회수 완료금액" value={won(collected)} sub={`회수율 ${pct(expected ? (collected / expected) * 100 : 0)}`} />
        <StatCard label="총 미회수금액" value={won(sum((r) => r.remaining_amount))} />
        <StatCard label="진행 중 투자" value={`${active}건`} />
        <StatCard label="종료된 투자" value={`${completed}건`} />
      </div>

      <section className="card mt-5">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-navy-900">최근 등록한 투자</h2>
          <Link href="/investments" className="text-sm text-navy-600 hover:underline">전체 보기 →</Link>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">아직 등록된 투자가 없습니다.</p>
        ) : (
          <ul>
            {[...rows]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 5)
              .map((r) => (
                <li key={r.id} className="border-b border-slate-100 last:border-0">
                  <Link href={`/investments/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50 sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-navy-900">{r.target_name}</div>
                      <div className="text-xs text-slate-500">{r.investment_no} · {r.customer_name} · {ymd(r.executed_on)}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">{won(r.principal)}</span>
                      <StatusBadge status={r.status} overdue={r.overdue_count > 0} />
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  );
}
