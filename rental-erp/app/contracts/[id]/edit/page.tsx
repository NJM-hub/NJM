import { notFound } from "next/navigation";
import { saveContractAction } from "@/app/actions/leasing";
import ContractForm from "@/components/ContractForm";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { contractSections } from "@/lib/fieldsets";
import { fmtDate } from "@/lib/dates";
import { tenantOptions, unitOptions } from "@/lib/views";

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("staff");
  const { id } = await params;
  const ds = await loadDataset();
  const c = ds.contracts.find((x) => x.id === id);
  if (!c) notFound();
  // 이전 계약(갱신 전) 후보: 같은 호실에서 이 계약보다 먼저 시작한 계약
  const tenantName = new Map(ds.tenants.map((t) => [t.id, t.name]));
  const prevOptions = ds.contracts
    .filter((x) => x.id !== c.id && x.unit_id === c.unit_id && x.start_date < c.start_date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((x) => ({ value: x.id, label: `${x.contract_no} · ${tenantName.get(x.tenant_id) ?? "?"} · ${fmtDate(x.start_date)} ~ ${fmtDate(x.end_date)}` }));
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
            previous_contract_id: c.previous_contract_id ?? "",
          }}
          sections={[
            ...contractSections(unitOptions(ds), tenantOptions(ds), true).map((s) => ({
              ...s,
              fields: s.fields.filter((f) => !["contract_no", "new_tenant_name", "new_tenant_phone", "new_tenant_biz_no"].includes(f.name)),
            })),
            {
              title: "갱신 연결",
              fields: [
                {
                  name: "previous_contract_id",
                  label: "이전 계약 (갱신 전)",
                  type: "select" as const,
                  options: prevOptions,
                  hint: "갱신 계약이면 이전 계약을 고르세요. 이전 계약은 '갱신'으로 바뀌고, 겹치는 달은 이전 계약에서 청구하지 않습니다.",
                },
              ],
            },
          ]}
        />
      </Card>
    </div>
  );
}
