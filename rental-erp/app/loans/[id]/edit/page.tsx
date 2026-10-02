import { notFound } from "next/navigation";
import { deleteLoanAction, saveLoanAction } from "@/app/actions/assets";
import ActionButton from "@/components/ActionButton";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { loanSections } from "@/lib/fieldsets";
import type { Loan } from "@/lib/types";

export default async function EditLoanPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("admin");
  const { id } = await params;
  const l = await q1<Loan>("select * from loans where id = $1", [id]).catch(() => null);
  if (!l) notFound();
  const props = await q<{ id: string; name: string }>("select id, name from properties order by name");
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title={`${l.lender} 대출 수정`} />
      <Card>
        <SmartForm
          action={saveLoanAction}
          cancelHref={`/loans/${id}`}
          initial={{ ...(l as unknown as Record<string, string>), interest_rate: String(l.interest_rate), is_closed: l.is_closed }}
          sections={loanSections(props.map((p) => ({ value: p.id, label: p.name })), true)}
        />
      </Card>
      <Card title="삭제">
        <ActionButton action={deleteLoanAction.bind(null, id)} className="btn-danger" confirm="대출과 상환 기록을 삭제할까요? (이자 비용 기록은 남습니다)">
          대출 삭제
        </ActionButton>
      </Card>
    </div>
  );
}
