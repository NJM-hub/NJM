import { saveContractAction } from "@/app/actions/leasing";
import ContractForm from "@/components/ContractForm";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { todayKST } from "@/lib/dates";
import { contractSections } from "@/lib/fieldsets";
import { tenantOptions, unitOptions } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ property?: string; unit?: string; tenant?: string; renew?: string }> }) {
  await requirePage("staff");
  const sp = await searchParams;
  const ds = await loadDataset();
  const units = unitOptions(ds).filter((u) => !sp.property || ds.units.find((x) => x.id === u.value)?.property_id === sp.property);
  const prev = sp.renew ? ds.contracts.find((c) => c.id === sp.renew) : undefined;
  const initial: Record<string, string | boolean> = {
    unit_id: prev?.unit_id ?? sp.unit ?? units[0]?.value ?? "",
    tenant_id: prev?.tenant_id ?? sp.tenant ?? "",
    status: "active",
    pay_day: String(prev?.pay_day ?? 25),
    contract_date: todayKST(),
  };
  if (prev) {
    // 갱신 계약: 종료일 다음 날부터 같은 조건으로
    const next = new Date(Date.UTC(+prev.end_date.slice(0, 4), +prev.end_date.slice(5, 7) - 1, +prev.end_date.slice(8, 10) + 1));
    Object.assign(initial, {
      start_date: next.toISOString().slice(0, 10),
      deposit: String(prev.deposit),
      monthly_rent: String(prev.monthly_rent),
      maintenance_fee: String(prev.maintenance_fee),
      vat_amount: String(prev.vat_amount),
      landlord_name: prev.landlord_name ?? "",
      special_terms: prev.special_terms ?? "",
      is_renewal: true,
      status: next.toISOString().slice(0, 10) > todayKST() ? "planned" : "active",
    });
  }
  return (
    <div className="max-w-5xl">
      <PageHeader title={prev ? `계약 갱신 (${prev.contract_no})` : "계약 등록"} desc="계약서를 올리면 AI 가 자동으로 입력합니다. 직접 입력해도 됩니다." />
      <Card>
        <ContractForm
          action={saveContractAction}
          edit={false}
          cancelHref="/contracts"
          initial={{ ...initial, previous_contract_id: prev?.id ?? "" }}
          sections={[
            ...contractSections(units.length ? units : unitOptions(ds), tenantOptions(ds), false),
            { fields: [{ name: "previous_contract_id", type: "hidden" }] },
          ]}
        />
      </Card>
    </div>
  );
}
