import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { methodLabel, statusInfo } from "@/lib/constants";
import { todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { listAllInvestments } from "@/lib/queries";
import { overview } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const o = overview(await listAllInvestments());

  return (
    <>
      <PageHeader title="전체 현황" description={`${ymd(todayKst())} 기준 · 취소 건 제외 ${o.count}건`} />

      {/* 대표 숫자 */}
      <section className="card card-body">
        <div className="text-sm font-medium text-slate-500">총 미회수금액</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl">{won(o.remaining)}</div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-slate-600">회수 {won(o.collected)} / 회수 예정 {won(o.expected)}</span>
            <span className="font-bold text-navy-900">{pct(o.recoveryRate)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-navy-700" style={{ width: `${Math.min(o.recoveryRate, 100)}%` }} />
          </div>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="navy" label="총 실행금액" value={won(o.principal)} sub={`${o.count}건`} />
        <StatCard label="총 회수예정금액" value={won(o.expected)} />
        <StatCard label="총 회수금액" value={won(o.collected)} sub={`회수율 ${pct(o.recoveryRate)}`} />
        <StatCard label="총 미회수금액" value={won(o.remaining)} />
        <StatCard label="평균 수익률" value={`${o.avgRateWeighted}%`} sub={`투자금액 가중 · 단순 평균 ${o.avgRateSimple}%`} />
        <StatCard label="진행 중 투자금액" value={won(o.activePrincipal)} sub={`${o.activeCount}건 · 남은 회수 ${won(o.activeRemaining)}`} />
        <StatCard tone={o.overdueCount > 0 ? "danger" : "default"} label="연체 투자금액" value={won(o.overduePrincipal)}
          sub={`${o.overdueCount}건 · 연체금액 ${won(o.overdueAmount)}`} />
        <StatCard tone={o.overdueCount > 0 ? "danger" : "default"} label="연체 건 남은 회수금액" value={won(o.overdueRemaining)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-navy-900 sm:px-5">상태별</h2>
          <table className="table">
            <thead><tr><th>상태</th><th className="num">건수</th><th className="num">투자금액</th><th className="num">남은 회수금액</th></tr></thead>
            <tbody>
              {o.byStatus.map((s) => (
                <tr key={s.status} className={s.status === "cancelled" ? "text-slate-400" : ""}>
                  <td><span className={`badge ${statusInfo(s.status).className}`}>{statusInfo(s.status).label}</span></td>
                  <td className="num">{s.count}</td>
                  <td className="num">{won(s.principal)}</td>
                  <td className="num">{won(s.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-2 text-xs text-slate-400">취소 건은 위 합계에 포함되지 않습니다.</p>
        </section>

        <section className="card overflow-x-auto">
          <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-navy-900 sm:px-5">회수방식별</h2>
          <table className="table">
            <thead><tr><th>회수방식</th><th className="num">건수</th><th className="num">투자금액</th><th className="num">남은 회수금액</th></tr></thead>
            <tbody>
              {o.byMethod.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">데이터가 없습니다</td></tr>
              ) : (
                o.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td>{methodLabel(m.method)}</td>
                    <td className="num">{m.count}</td>
                    <td className="num">{won(m.principal)}</td>
                    <td className="num">{won(m.remaining)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
