import { notFound } from "next/navigation";
import { saveContractAction } from "@/app/actions/leasing";
import ContractForm from "@/components/ContractForm";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { contractSections } from "@/lib/fieldsets";
import { tenantOptions, unitOptions } from "@/lib/views";

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("staff");
  const { id } = await params;
  const ds = await loadDataset();
  const c = ds.contracts.find((x) => x.id === id);
  if (!c) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader title={`계약 수정 (${c.contract_no})`} desc="금액을 바꾸면 이번 달부터 입금이 없는 청구가 새 금액으로 다시 만들어집니다." />
      <Card>
        <ContractForm
          action={saveContractAction}
          edit
          cancelHref={`/contracts/${id}`}
          initial={{
            ...(c as unknown as Record<string, string>),
            billing_from: c.billing_from?.slice(0, 7) ?? "",
            is_renewal: c.is_renewal,
          }}
          sections={contractSections(unitOptions(ds), tenantOptions(ds), true).map((s) => ({
            ...s,
            fields: s.fields.filter((f) => !["contract_no", "new_tenant_name", "new_tenant_phone", "new_tenant_biz_no"].includes(f.name)),
          }))}
        />
      </Card>
    </div>
  );
}
