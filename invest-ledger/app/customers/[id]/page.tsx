import Link from "next/link";
import { notFound } from "next/navigation";
import AlertBadge from "@/components/AlertBadge";
import CustomerStatusButton from "@/components/CustomerStatusButton";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { toggleCustomerStatusAction } from "@/app/customers/actions";
import { methodLabel } from "@/lib/constants";
import { todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { customerSummaries } from "@/lib/listing";
import { getCustomer, listCustomerInvestments } from "@/lib/queries";
import { alertLevel } from "@/lib/stats";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  saved: "고객 정보를 저장했습니다.",
  inactive: "'미사용'으로 바꿨습니다. 데이터는 그대로 남아 있습니다.",
  active: "'사용'으로 바꿨습니다.",
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, { msg }] = await Promise.all([params, searchParams]);
  const c = await getCustomer(id);
  if (!c) notFound();
  const investments = await listCustomerInvestments(c.id);
  const today = todayKst();
  const [s] = customerSummaries([c], investments, today);
  const active = c.status === "active";

  return (
    <>
      <div className="mb-3">
        <Link href="/customers" className="text-sm text-navy-600 hover:underline">← 고객 목록</Link>
      </div>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {c.phone ? <a href={`tel:${c.phone}`} className="text-navy-600 underline">{c.phone}</a> : "연락처 없음"}
            {!active && <span className="badge bg-gray-100 text-gray-500 ring-gray-200">미사용</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/investments/new?customer=${c.id}`} className="btn">+ 이 고객 투자 등록</Link>
            <Link href={`/customers/${c.id}/edit`} className="btn-secondary">정보 수정</Link>
            <CustomerStatusButton action={toggleCustomerStatusAction.bind(null, c.id, active ? "inactive" : "active")} active={active} />
          </>
        }
      />

      {msg && MESSAGES[msg] && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{MESSAGES[msg]}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard tone="navy" label="총 투자금액" value={won(s.totalPrincipal)} />
        <StatCard label="총 회수금액" value={won(s.totalCollected)} />
        <StatCard label="총 미회수금액" value={won(s.totalRemaining)} />
        <StatCard label="투자 건수" value={`${s.investmentCount}건`} sub={`진행 중 ${s.activeCount}건`} />
        <StatCard tone={s.overdueCount > 0 ? "danger" : "default"} label="연체 건수" value={`${s.overdueCount}건`} />
      </div>

      {c.memo && (
        <div className="card card-body mt-3 text-sm">
          <span className="text-slate-500">메모 · </span><span className="whitespace-pre-wrap">{c.memo}</span>
        </div>
      )}

      <section className="card mt-5">
        <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-navy-900 sm:px-5">
          투자내역 <span className="text-sm font-normal text-slate-500">· 취소 건 포함 {investments.length}건 (합계에서는 취소 제외)</span>
        </h2>
        {investments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">투자내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {investments.map((r) => {
              const lv = alertLevel(r, today);
              return (
                <li key={r.id}>
                  <Link href={`/investments/${r.id}`}
                    className={`flex flex-col gap-2 px-4 py-3 hover:bg-navy-50 sm:flex-row sm:items-center sm:px-5 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-navy-900">{r.target_name}</span>
                        <StatusBadge status={r.status} />
                        {lv && <AlertBadge level={lv} />}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.investment_no} · 실행 {ymd(r.executed_on)} · {methodLabel(r.repayment_method)} {r.period_days}일 · 만기 {ymd(r.maturity_on)}
                      </div>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-4 text-right text-xs sm:w-96">
                      <div><div className="text-slate-500">투자금액</div><div className="text-sm tabular-nums">{won(r.principal)}</div></div>
                      <div><div className="text-slate-500">회수 ({pct(r.recovery_rate)})</div><div className="text-sm tabular-nums">{won(r.collected_amount)}</div></div>
                      <div><div className="text-slate-500">미회수</div><div className="text-sm font-semibold tabular-nums">{won(r.remaining_amount)}</div></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
