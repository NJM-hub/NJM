import InvestmentForm from "@/components/InvestmentForm";
import PageHeader from "@/components/PageHeader";
import { createInvestment } from "@/app/investments/actions";
import { todayKst } from "@/lib/dates";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewInvestmentPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const [{ customer }, customers] = await Promise.all([searchParams, listCustomers()]);
  const initialCustomerId = customers.some((c) => c.id === customer) ? customer : undefined;
  return (
    <>
      <PageHeader title="투자 등록" description="* 표시는 필수 항목입니다. 총 회수 예정금액과 만기일은 자동으로 계산됩니다." />
      <InvestmentForm
        action={createInvestment}
        customers={customers}
        today={todayKst()}
        submitLabel="투자 등록"
        cancelHref={initialCustomerId ? `/customers/${initialCustomerId}` : "/investments"}
        initialCustomerId={initialCustomerId}
      />
    </>
  );
}
