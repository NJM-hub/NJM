import Link from "next/link";
import { notFound } from "next/navigation";
import StatCard from "@/components/StatCard";
import StatusActions from "@/components/StatusActions";
import StatusBadge from "@/components/StatusBadge";
import { REPAYMENT_METHODS } from "@/lib/constants";
import { percent, rate, won, ymd } from "@/lib/format";
import { getInvestment } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvestmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const inv = await getInvestment(id);
  if (!inv) notFound();

  const info: [string, React.ReactNode][] = [
    ["투자번호", inv.investment_no],
    ["투자 실행일", ymd(inv.executed_on)],
    ["투자 실행금액", won(inv.principal)],
    ["투자 대상명", inv.target_name],
    ["고객명", inv.customer_name],
    [
      "연락처",
      inv.customer_phone ? (
        <a href={`tel:${inv.customer_phone}`} className="text-navy-600 underline">
          {inv.customer_phone}
        </a>
      ) : (
        "-"
      ),
    ],
    ["수익률", rate(inv.return_rate)],
    ["회수방식", REPAYMENT_METHODS[inv.repayment_method]],
    ["회수기간", `${inv.term_days}일`],
    ["회수 시작일", ymd(inv.start_on)],
    ["회수 만기일", ymd(inv.maturity_on)],
    ["상태", <StatusBadge key="s" status={inv.status} overdue={inv.overdue_amount > 0} />],
  ];

  return (
    <div className="space-y-5">
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          저장되었습니다.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/investments" className="text-sm text-slate-500 hover:underline">
            ← 투자 목록
          </Link>
          <h1 className="page-title mt-1">
            {inv.target_name} <span className="text-base font-medium text-slate-500">{inv.investment_no}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/investments/${inv.id}/edit`} className="btn">
            수정
          </Link>
          <StatusActions id={inv.id} status={inv.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="총 회수 예정금액" value={won(inv.expected_total)} tone="navy" />
        <StatCard label="현재까지 회수금액" value={won(inv.paid_total)} tone="green" />
        <StatCard label="남은 회수금액" value={won(inv.remaining_amount)} />
        <StatCard label="회수율" value={percent(inv.recovery_rate)} />
        <StatCard label="경과일수" value={`${inv.elapsed_days.toLocaleString("ko-KR")}일`} sub="투자 실행일부터" />
        <StatCard
          label="남은 회수기간"
          value={`${inv.remaining_days.toLocaleString("ko-KR")}일`}
          sub={inv.days_to_maturity < 0 ? `만기 ${-inv.days_to_maturity}일 지남` : "만기일까지"}
        />
        <StatCard label="연체금액" value={won(inv.overdue_amount)} tone={inv.overdue_amount > 0 ? "red" : "default"} />
        <StatCard label="마지막 회수일" value={ymd(inv.last_paid_on)} />
      </div>

      <div className="card">
        <h2 className="card-title">투자 정보</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {info.map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-navy-900">{val}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <p className="text-sm text-slate-500">메모</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{inv.memo || "-"}</p>
        </div>
      </div>

      <div className="card border-dashed text-sm text-slate-500">
        회차별 회수계획과 실제 회수 입력은 <b>2단계</b>에서 이 화면에 추가됩니다.
      </div>
    </div>
  );
}
