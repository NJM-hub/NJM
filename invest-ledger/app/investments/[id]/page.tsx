import Link from "next/link";
import { notFound } from "next/navigation";
import GenerateScheduleButton from "@/components/GenerateScheduleButton";
import PageHeader from "@/components/PageHeader";
import PaymentForm from "@/components/PaymentForm";
import RepaymentList from "@/components/RepaymentList";
import ScheduleTable from "@/components/ScheduleTable";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import StatusChangeForm from "@/components/StatusChangeForm";
import { changeInvestmentStatus } from "@/app/investments/actions";
import {
  generateScheduleAction,
  quickPayAction,
  recordPaymentAction,
  voidRepaymentAction,
} from "@/app/investments/repayment-actions";
import { methodLabel } from "@/lib/constants";
import { todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { getInvestment, getRepayments, getSchedules } from "@/lib/queries";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  saved: { text: "저장되었습니다.", tone: "ok" },
  status: { text: "상태가 변경되었습니다.", tone: "ok" },
  schedule: { text: "회수계획을 만들었습니다.", tone: "ok" },
  schedule_saved: { text: "회차를 저장했습니다.", tone: "ok" },
  paid: { text: "입금을 기록했습니다.", tone: "ok" },
  void: { text: "입금 기록을 취소했습니다. (삭제되지 않고 '취소됨'으로 남습니다)", tone: "ok" },
  schedule_kept: {
    text: "투자 조건이 바뀌었지만 이미 입금 기록이 있어 회수계획은 그대로 두었습니다. 필요한 회차를 직접 수정·추가하세요.",
    tone: "warn",
  },
  schedule_failed: { text: "투자는 등록됐지만 회수계획을 만들지 못했습니다. 아래 [회수계획 만들기]를 눌러주세요.", tone: "warn" },
};

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
  searchParams: Promise<{ msg?: string; saved?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const inv = await getInvestment(id);
  if (!inv) notFound();
  const [schedules, repayments] = await Promise.all([getSchedules(inv.id), getRepayments(inv.id)]);

  const today = todayKst();
  const message = MESSAGES[sp.msg ?? (sp.saved ? "saved" : "")];
  const unpaidRows = schedules.filter((s) => s.unpaid_amount > 0);
  const next = unpaidRows.find((s) => s.due_date >= today) ?? null;
  const dueByToday = unpaidRows.filter((s) => s.due_date <= today).reduce((a, s) => a + s.unpaid_amount, 0);
  const plannedSum = schedules.reduce((a, s) => a + s.planned_amount, 0);
  const planMismatch = schedules.length > 0 && plannedSum !== inv.expected_total;
  const hasLinkedPayments = repayments.some((r) => r.status === "valid" && r.schedule_id);
  const seqById = Object.fromEntries(schedules.map((s) => [s.id, s.seq]));
  const validPaidSum = repayments.filter((r) => r.status === "valid").reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <div className="mb-3">
        <Link href="/investments" className="text-sm text-navy-600 hover:underline">← 투자 목록</Link>
      </div>
      <PageHeader
        title={inv.target_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{inv.investment_no}</span>
            <span>{inv.customer_name}</span>
            <StatusBadge status={inv.status} overdue={inv.overdue_count > 0} />
          </span>
        }
        actions={<Link href={`/investments/${inv.id}/edit`} className="btn-secondary">정보 수정</Link>}
      />

      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
        }`}>{message.text}</div>
      )}

      {/* 요약 숫자 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="navy" label="총 회수 예정금액" value={won(inv.expected_total)} sub={`투자 ${won(inv.principal)} · 수익률 ${Number(inv.return_rate)}%`} />
        <StatCard label="현재까지 회수금액" value={won(inv.collected_amount)} sub={`회수율 ${pct(inv.recovery_rate)}`} />
        <StatCard label="남은 회수금액" value={won(inv.remaining_amount)} />
        <StatCard tone={inv.overdue_amount > 0 ? "danger" : "default"} label="연체금액" value={won(inv.overdue_amount)} sub={`${inv.overdue_count}개 회차`} />
        <StatCard label="오늘까지 받을 금액" value={won(dueByToday)} sub="연체 + 오늘 예정" />
        <StatCard label="다음 회수 예정" value={next ? won(next.unpaid_amount) : "-"} sub={next ? `${next.seq}회차 · ${ymd(next.due_date)}` : "남은 회차 없음"} />
        <StatCard label="경과일수" value={`${inv.elapsed_days}일`} sub={`회수기간 ${inv.period_days}일`} />
        <StatCard label="남은 회수기간" value={`${inv.remaining_days}일`} sub={`만기 ${ymd(inv.maturity_on)}`} />
      </div>

      <div className="card card-body mt-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-slate-700">회수율</span>
          <span className="font-bold text-navy-900 tabular-nums">{pct(inv.recovery_rate)}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-navy-700" style={{ width: `${Math.min(inv.recovery_rate, 100)}%` }} />
        </div>
      </div>

      {/* 입금 등록 + 실제 회수내역 */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <section className="card card-body">
          <h2 className="mb-1 text-base font-semibold text-navy-900">입금 등록</h2>
          <p className="mb-3 text-xs text-slate-500">
            실제로 돈을 받았을 때 기록합니다. 한 회차만 받았다면 표의 <b>[완납]</b> 버튼이 더 빠릅니다.
          </p>
          <PaymentForm
            key={`${validPaidSum}-${repayments.length}`}
            action={recordPaymentAction.bind(null, inv.id)}
            schedules={schedules}
            today={today}
          />
        </section>

        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-navy-900 sm:px-5">
            실제 회수내역 <span className="text-sm font-normal text-slate-500">· {repayments.filter((r) => r.status === "valid").length}건</span>
          </h2>
          <RepaymentList repayments={repayments} seqById={seqById} voidAction={voidRepaymentAction.bind(null, inv.id)} />
        </section>
      </div>

      {/* 회수계획 */}
        <section className="card mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-navy-900">
              회수계획 <span className="text-sm font-normal text-slate-500">· {methodLabel(inv.repayment_method)} {schedules.length}회</span>
            </h2>
            {schedules.length > 0 && !hasLinkedPayments && (
              <GenerateScheduleButton
                action={generateScheduleAction.bind(null, inv.id)}
                label="다시 만들기"
                className="btn-secondary !px-3 !py-1 !text-xs"
                confirmText={"지금 투자 조건으로 회수계획을 다시 만들까요?\n기존 회차는 지워지지 않고 '무효'로 보관됩니다."}
              />
            )}
          </div>
          {planMismatch && (
            <p className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-900">
              회차 예정금액 합계 {won(plannedSum)}가 총 회수 예정금액 {won(inv.expected_total)}와 다릅니다.
              {hasLinkedPayments ? " 필요한 회차를 수정하거나 추가하세요." : " [다시 만들기]를 누르면 맞춰집니다."}
            </p>
          )}
          {schedules.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="mb-4 text-sm text-slate-500">아직 회수계획이 없습니다. 투자 조건에 맞춰 회차를 자동으로 만듭니다.</p>
              <div className="inline-block">
                <GenerateScheduleButton action={generateScheduleAction.bind(null, inv.id)} label="회수계획 만들기" />
              </div>
            </div>
          ) : (
            <ScheduleTable investmentId={inv.id} schedules={schedules} today={today} quickPay={quickPayAction.bind(null, inv.id)} />
          )}
        </section>


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

        <section className="card card-body">
          <h2 className="mb-1 text-base font-semibold text-navy-900">상태 변경</h2>
          <p className="mb-3 text-xs text-slate-500">
            데이터는 삭제하지 않습니다. 잘못 등록한 건은 &lsquo;취소&rsquo;로 바꾸면 목록에서 숨겨지고, 언제든 되돌릴 수 있습니다.
            전액 회수되면 자동으로 &lsquo;완료&rsquo;가 됩니다.
            {inv.status_reason && <> 현재 사유: <b>{inv.status_reason}</b></>}
          </p>
          <StatusChangeForm action={changeInvestmentStatus.bind(null, inv.id)} current={inv.status} currentReason={inv.status_reason} />
        </section>
      </div>
    </>
  );
}
