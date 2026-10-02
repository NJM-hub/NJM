import { saveLoanAction } from "@/app/actions/assets";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { q } from "@/lib/db";
import { loanSections } from "@/lib/fieldsets";

export default async function NewLoanPage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  await requirePage("admin");
  const { property } = await searchParams;
  const props = await q<{ id: string; name: string }>("select id, name from properties where is_active order by name");
  return (
    <div className="max-w-4xl">
      <PageHeader title="대출 등록" desc="부동산 1개에 대출을 여러 개 등록할 수 있습니다." />
      <Card>
        <SmartForm
          action={saveLoanAction}
          cancelHref="/loans"
          initial={{ property_id: property ?? props[0]?.id ?? "", rate_type: "variable", repayment_type: "bullet" }}
          sections={loanSections(props.map((p) => ({ value: p.id, label: p.name })), false)}
        />
      </Card>
    </div>
  );
}
