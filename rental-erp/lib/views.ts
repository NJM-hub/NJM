// 화면용 데이터 가공 (순수 함수)
import type { PayContractOption } from "@/components/PaymentForm";
import { monthLabel } from "@/lib/dates";
import { effectiveEnd } from "@/lib/engine";
import type { Contract, Dataset } from "@/lib/types";

export function unitLabel(ds: Pick<Dataset, "units" | "properties">, unitId: string): string {
  const u = ds.units.find((x) => x.id === unitId);
  const p = u ? ds.properties.find((x) => x.id === u.property_id) : undefined;
  return [p?.name, u?.dong ? `${u.dong}동` : null, u?.unit_no].filter(Boolean).join(" ");
}

/** 입금 등록 화면의 계약 선택 목록 (진행 중 계약 + 미납이 남은 계약) */
export function payOptions(ds: Dataset, today: string, only?: (c: Contract) => boolean): PayContractOption[] {
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const list = ds.contracts.filter((c) => {
    if (only && !only(c)) return false;
    const open = ds.charges.some((ch) => ch.contract_id === c.id && ch.amount > ch.paid_amount);
    const live = c.status !== "planned" && c.start_date <= today && effectiveEnd(c) >= today && c.status !== "terminated";
    return open || live;
  });
  return list
    .map((c) => {
      const charges = ds.charges
        .filter((ch) => ch.contract_id === c.id && ch.amount > ch.paid_amount)
        .sort((a, b) => a.billing_month.localeCompare(b.billing_month))
        .map((ch) => ({ id: ch.id, label: monthLabel(ch.billing_month), unpaid: ch.amount - ch.paid_amount, overdue: ch.due_date < today }));
      return { id: c.id, label: `${tenant.get(c.tenant_id)?.name ?? "?"} / ${unitLabel(ds, c.unit_id)}`, charges };
    })
    .sort((a, b) => Number(b.charges.some((x) => x.overdue)) - Number(a.charges.some((x) => x.overdue)) || a.label.localeCompare(b.label, "ko"));
}

export function unitOptions(ds: Pick<Dataset, "units" | "properties">) {
  return ds.units
    .filter((u) => u.is_active)
    .map((u) => ({ value: u.id, label: unitLabel(ds, u.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

export function tenantOptions(ds: Pick<Dataset, "tenants">) {
  return ds.tenants.map((t) => ({ value: t.id, label: `${t.name}${t.phone ? ` (${t.phone})` : ""}` }));
}
