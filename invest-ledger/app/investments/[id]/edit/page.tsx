import { notFound } from "next/navigation";
import InvestmentForm from "@/components/InvestmentForm";
import PageHeader from "@/components/PageHeader";
import { updateInvestment } from "@/app/investments/actions";
import { todayKst } from "@/lib/dates";
import { getInvestment, listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditInvestmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, customers] = await Promise.all([getInvestment(id), listCustomers()]);
  if (!inv) notFound();

  // 비활성 고객이 연결된 경우에도 선택 목록에 보이도록 추가
  const options = customers.some((c) => c.id === inv.customer_id)
    ? customers
    : [{ id: inv.customer_id, name: inv.customer_name, phone: inv.customer_phone, memo: "", status: "inactive" as const, created_at: "" }, ...customers];

  return (
    <>
      <PageHeader title={`투자 수정 · ${inv.investment_no}`} description="수정 내용은 변경 이력에 자동으로 기록됩니다." />
      <InvestmentForm
        action={updateInvestment.bind(null, inv.id)}
        customers={options}
        initial={inv}
        today={todayKst()}
        submitLabel="수정 저장"
        cancelHref={`/investments/${inv.id}`}
      />
    </>
  );
}
