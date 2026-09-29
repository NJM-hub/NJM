import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import StatusChangeForm from "@/components/StatusChangeForm";
import { changeInvestmentStatus } from "@/app/investments/actions";
import { methodLabel } from "@/lib/constants";
import { pct, won, ymd } from "@/lib/format";
import { getInvestment } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

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

  return (
    <>
      <div className="mb-3">
        <Link href="/investments" className="text-sm text-navy-600 hover:underline">← 투자 목록</Link>
      </div>
      <PageHeader
        title={`${inv.target_name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{inv.investment_no}</span>
            <StatusBadge status={inv.status} overdue={inv.overdue_count > 0} />
          </span>
        }
        actions={<Link href={`/investments/${inv.id}/edit`} className="btn-secondary">정보 수정</Link>}
      />

      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">저장되었습니다.</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="navy" label="총 회수 예정금액" value={won(inv.expected_total)} sub={`투자 ${won(inv.principal)} · 수익률 ${Number(inv.return_rate)}%`} />
        <StatCard label="현재까지 회수금액" value={won(inv.collected_amount)} sub={`회수율 ${pct(inv.recovery_rate)}`} />
        <StatCard label="남은 회수금액" value={won(inv.remaining_amount)} />
        <StatCard tone={inv.overdue_amount > 0 ? "danger" : "default"} label="연체금액" value={won(inv.overdue_amount)} sub={`${inv.overdue_count}회차`} />
      </div>

      {/* 회수율 막대 */}
      <div className="card card-body mt-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-slate-700">회수율</span>
          <span className="font-bold text-navy-900 tabular-nums">{pct(inv.recovery_rate)}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-navy-700" style={{ width: `${Math.min(inv.recovery_rate, 100)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>경과 {inv.elapsed_days}일 / {inv.period_days}일</span>
          <span>만기까지 {inv.remaining_days}일</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card card-body">
          <h2 className="mb-2 text-base font-semibold text-navy-900">기본 정보</h2>
          <dl>
            <Row label="고객명">{inv.customer_name}</Row>
            <Row label="연락처">
              {inv.customer_phone ? <a href={`tel:${inv.customer_phone}`} className="text-navy-600 underline">{inv.customer_phone}</a> : "-"}
            </Row>
            <Row label="투자 실행일">{ymd(inv.executed_on)}</Row>
            <Row label="투자 실행금액">{won(inv.principal)}</Row>
            <Row label="수익률">{Number(inv.return_rate)}%</Row>
            <Row label="회수방식">{methodLabel(inv.repayment_method)}</Row>
            <Row label="회수기간">{inv.period_days}일</Row>
            <Row label="회수 시작일">{ymd(inv.start_on)}</Row>
            <Row label="회수 만기일">{ymd(inv.maturity_on)}</Row>
            <Row label="메모"><span className="whitespace-pre-wrap">{inv.memo || "-"}</span></Row>
          </dl>
        </section>

        <div className="space-y-5">
          <section className="card card-body">
            <h2 className="mb-1 text-base font-semibold text-navy-900">상태 변경</h2>
            <p className="mb-3 text-xs text-slate-500">
              데이터는 삭제하지 않습니다. 잘못 등록한 건은 &lsquo;취소&rsquo;로 바꾸면 목록에서 숨겨지고, 언제든 되돌릴 수 있습니다.
              {inv.status_reason && <> 현재 사유: <b>{inv.status_reason}</b></>}
            </p>
            <StatusChangeForm action={changeInvestmentStatus.bind(null, inv.id)} current={inv.status} currentReason={inv.status_reason} />
          </section>

          <section className="card card-body border-dashed">
            <h2 className="mb-1 text-base font-semibold text-navy-900">회수 계획 · 실제 회수내역</h2>
            <p className="text-sm text-slate-500">2단계에서 이 자리에 회차별 회수 예정일·금액과 실제 입금 기록이 표시됩니다.</p>
          </section>
        </div>
      </div>
    </>
  );
}
