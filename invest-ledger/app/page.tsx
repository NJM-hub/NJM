import Link from "next/link";
import AlertList from "@/components/AlertList";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { addDays, todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { listAllInvestments, listPaymentsBetween, listSchedulesBetween } from "@/lib/queries";
import { buildAlerts, dashboard, liveInvestments } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayKst();
  const [investments, upcoming, paidToday] = await Promise.all([
    listAllInvestments(),
    listSchedulesBetween(today, addDays(today, 7)),
    listPaymentsBetween(today, today),
  ]);
  const d = dashboard(investments, upcoming, paidToday, today);
  const live = liveInvestments(investments);
  const alerts = buildAlerts(live, today);

  // 오늘 받을 회차가 있는 투자
  const byId = new Map(live.map((r) => [r.id, r]));
  const todayMap = new Map<string, number>();
  for (const s of upcoming) {
    if (s.due_date === today && s.unpaid_amount > 0 && byId.has(s.investment_id)) {
      todayMap.set(s.investment_id, (todayMap.get(s.investment_id) ?? 0) + s.unpaid_amount);
    }
  }
  const todayList = [...todayMap.entries()].map(([id, amount]) => ({ inv: byId.get(id)!, amount })).sort((a, b) => b.amount - a.amount);

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`오늘 ${ymd(today)} · 취소 건 제외`}
        actions={<Link href="/investments/new" className="btn">+ 투자 등록</Link>}
      />

      {/* 받을 금액 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="navy" label="오늘 받을 금액" value={won(d.receiveToday)} sub="오늘 예정 중 아직 안 받은 금액" />
        <StatCard label="내일 받을 금액" value={won(d.receiveTomorrow)} sub={ymd(addDays(today, 1))} />
        <StatCard label="7일 이내 받을 금액" value={won(d.receive7)} sub={`~ ${ymd(addDays(today, 7))}`} />
        <StatCard tone={d.overdueAmount > 0 ? "danger" : "default"} label="연체된 금액" value={won(d.overdueAmount)} sub={`${d.overdueCount}건`} />
      </div>

      <div className="mt-5">
        <AlertList alerts={alerts} />
      </div>

      {/* 전체 숫자 */}
      <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-500">전체 요약</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="총 투자 실행금액" value={won(d.totalPrincipal)} />
        <StatCard label="총 회수 예정금액" value={won(d.totalExpected)} />
        <StatCard label="총 회수 완료금액" value={won(d.totalCollected)} sub={`회수율 ${pct(d.totalExpected ? (d.totalCollected / d.totalExpected) * 100 : 0)}`} />
        <StatCard label="총 미회수금액" value={won(d.totalRemaining)} />
        <StatCard label="오늘 회수 예정금액" value={won(d.todayPlanned)} sub="오늘 예정 회차 합계" />
        <StatCard tone="success" label="오늘 실제 회수금액" value={won(d.todayPaid)} />
        <StatCard tone={d.overdueAmount > 0 ? "danger" : "default"} label="연체금액" value={won(d.overdueAmount)} />
        <StatCard tone={d.overdueCount > 0 ? "danger" : "default"} label="연체 건수" value={`${d.overdueCount}건`} />
        <StatCard label="진행 중 투자" value={`${d.activeCount}건`} />
        <StatCard label="종료된 투자" value={`${d.closedCount}건`} />
      </div>

      {/* 오늘 받을 투자 */}
      <section className="card mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-navy-900">오늘 받을 투자 <span className="text-sm font-normal text-slate-500">· {todayList.length}건</span></h2>
          <Link href="/investments" className="text-sm text-navy-600 hover:underline">투자 목록 →</Link>
        </div>
        {todayList.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">오늘 받을 금액이 남아 있는 투자가 없습니다.</p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-auto">
            {todayList.map(({ inv, amount }) => (
              <li key={inv.id}>
                <Link href={`/investments/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-navy-900">{inv.target_name}</div>
                    <div className="text-xs text-slate-500">{inv.investment_no} · {inv.customer_name}{inv.customer_phone && ` · ${inv.customer_phone}`}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{won(amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
