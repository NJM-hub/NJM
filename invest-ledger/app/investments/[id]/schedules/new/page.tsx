import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ScheduleForm from "@/components/ScheduleForm";
import { addScheduleAction } from "@/app/investments/repayment-actions";
import { getInvestment } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvestment(id);
  if (!inv) notFound();

  return (
    <>
      <div className="mb-3">
        <Link href={`/investments/${inv.id}`} className="text-sm text-navy-600 hover:underline">← {inv.target_name}</Link>
      </div>
      <PageHeader title="회차 추가" description={`${inv.investment_no} · 만기 연장이나 추가 회수가 필요할 때 사용합니다.`} />
      <ScheduleForm
        action={addScheduleAction.bind(null, inv.id)}
        initial={{ dueDate: inv.maturity_on, plannedAmount: null, memo: "" }}
        cancelHref={`/investments/${inv.id}`}
        submitLabel="회차 추가"
      />
    </>
  );
}
