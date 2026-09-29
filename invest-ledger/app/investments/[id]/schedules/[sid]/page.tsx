import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ScheduleForm from "@/components/ScheduleForm";
import { updateScheduleAction } from "@/app/investments/repayment-actions";
import { won, ymd } from "@/lib/format";
import { getInvestment, getSchedule } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const [inv, s] = await Promise.all([getInvestment(id), getSchedule(sid)]);
  if (!inv || !s || s.investment_id !== inv.id) notFound();

  return (
    <>
      <div className="mb-3">
        <Link href={`/investments/${inv.id}`} className="text-sm text-navy-600 hover:underline">← {inv.target_name}</Link>
      </div>
      <PageHeader
        title={`${s.seq}회차 수정`}
        description={`${inv.investment_no} · 현재 입금 ${won(s.paid_amount)} / 미회수 ${won(s.unpaid_amount)}${s.last_paid_on ? ` · 최근 입금 ${ymd(s.last_paid_on)}` : ""}`}
      />
      <ScheduleForm
        action={updateScheduleAction.bind(null, inv.id, s.id)}
        initial={{ dueDate: s.due_date, plannedAmount: s.planned_amount, memo: s.memo }}
        cancelHref={`/investments/${inv.id}`}
        submitLabel="저장"
      />
      <p className="mt-3 text-xs text-slate-500">
        실제 입금은 이 화면이 아니라 투자 상세 화면의 &lsquo;입금 등록&rsquo; 또는 &lsquo;완납&rsquo; 버튼으로 기록합니다.
        미회수 회차도 지우지 않고 그대로 남아 연체로 표시됩니다.
      </p>
    </>
  );
}
