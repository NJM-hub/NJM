import EnvNotice from "@/components/EnvNotice";
import InvestmentForm from "@/components/InvestmentForm";
import { emptyInvestmentValues } from "@/lib/investmentForm";
import { missingEnv } from "@/lib/env";
import { listCustomers } from "@/lib/queries";
import { createInvestment } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInvestmentPage() {
  const missing = missingEnv();
  if (missing.length) return <EnvNotice missing={missing} />;

  const customers = await listCustomers();
  return (
    <div className="space-y-5">
      <h1 className="page-title">투자 등록</h1>
      <InvestmentForm
        mode="create"
        initial={emptyInvestmentValues()}
        customers={customers}
        action={createInvestment}
        cancelHref="/investments"
      />
    </div>
  );
}
