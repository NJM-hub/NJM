import { notFound } from "next/navigation";
import InvestmentForm from "@/components/InvestmentForm";
import { withComma } from "@/lib/format";
import { getInvestment, listCustomers } from "@/lib/queries";
import { updateInvestment } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditInvestmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, customers] = await Promise.all([getInvestment(id), listCustomers()]);
  if (!inv) notFound();

  return (
    <div className="space-y-5">
      <h1 className="page-title">투자 수정 · {inv.investment_no}</h1>
      <InvestmentForm
        mode="edit"
        initial={{
          investment_no: inv.investment_no,
          executed_on: inv.executed_on,
          principal: withComma(inv.principal),
          target_name: inv.target_name,
          customer_name: inv.customer_name,
          customer_phone: inv.customer_phone ?? "",
          return_rate: String(Number(inv.return_rate)),
          repayment_method: inv.repayment_method,
          term_days: String(inv.term_days),
          start_on: inv.start_on,
          maturity_on: inv.maturity_on,
          memo: inv.memo ?? "",
          status: inv.status,
        }}
        customers={customers}
        action={updateInvestment.bind(null, inv.id)}
        cancelHref={`/investments/${inv.id}`}
      />
    </div>
  );
}
