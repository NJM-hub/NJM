import Link from "next/link";
import AlertBadge from "@/components/AlertBadge";
import { won, ymd } from "@/lib/format";
import { ALERT_LEVELS, dDayLabel, type AlertLevel, type AlertRow } from "@/lib/stats";

/** 만기 임박·연체 투자 목록 (대시보드) */
export default function AlertList({ alerts }: { alerts: AlertRow[] }) {
  const counts = Object.keys(ALERT_LEVELS).map((k) => ({
    level: k as AlertLevel,
    n: alerts.filter((a) => a.level === k).length,
  }));

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="mr-2 text-base font-semibold text-navy-900">만기·연체 알림</h2>
        {counts.map((c) => (
          <span key={c.level} className="inline-flex items-center gap-1 text-xs text-slate-600">
            <AlertBadge level={c.level} /> <b className="tabular-nums">{c.n}</b>
          </span>
        ))}
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">만기가 임박했거나 연체된 투자가 없습니다. 👍</p>
      ) : (
        <ul className="max-h-[480px] divide-y divide-slate-100 overflow-auto">
          {alerts.map(({ inv, level, dDay }) => (
            <li key={inv.id}>
              <Link href={`/investments/${inv.id}`}
                className={`flex flex-col gap-2 px-4 py-3 hover:bg-navy-50 sm:flex-row sm:items-center sm:px-5 ${level === "overdue" ? "border-l-4 border-red-700" : ""}`}>
                <div className="flex shrink-0 items-center gap-2 sm:w-48">
                  <AlertBadge level={level} />
                  <span className="text-xs font-semibold tabular-nums text-slate-600">
                    {level === "overdue" && dDay >= 0 ? `${inv.overdue_count}회차 미납` : dDay < 0 ? `만기 ${dDayLabel(dDay)}` : dDayLabel(dDay)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-navy-900">{inv.target_name}</div>
                  <div className="text-xs text-slate-500">{inv.investment_no} · {inv.customer_name} · 만기 {ymd(inv.maturity_on)}</div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-4 text-right text-xs sm:w-72">
                  <div><div className="text-slate-500">미회수</div><div className="text-sm font-semibold tabular-nums">{won(inv.remaining_amount)}</div></div>
                  <div><div className="text-slate-500">연체금액</div><div className={`text-sm font-semibold tabular-nums ${inv.overdue_amount > 0 ? "text-red-700" : "text-slate-400"}`}>{won(inv.overdue_amount)}</div></div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
