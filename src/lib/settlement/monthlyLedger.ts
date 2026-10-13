import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { monthRange } from "@/lib/format";
import { withoutVat } from "@/lib/kkday/statement";
import { loadVehicleMonth } from "./vehicleMonthlyLoad";

/** 직접 입력 지출 항목: 정산표 칸 ↔ monthly_ledger 컬럼 */
export const LEDGER_CATEGORIES = [
  { key: "installment", label: "차량 할부금", column: "vehicle_installment" },
  { key: "withholding", label: "원천 지출", column: "cash_expense" },
  { key: "cash", label: "현금 지출", column: "cash_spend" },
  { key: "office", label: "사무실 지출", column: "office_expense" },
] as const;
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number]["key"];

export type LedgerItem = {
  id: string; month: string; category: LedgerCategory; spent_on: string | null;
  description: string; amount: number; memo: string | null;
};

export type MonthLedger = {
  month: string;
  /** KKday 정산내역서 합계 (실제로 정산 받은 금액, 부가세 포함) */
  kkdayAmount: number;
  /** 정산내역서 합계와 조정 금액 (kkdayAmount = 내역서 + 조정) */
  kkdayStatement: number;
  kkdayAdjust: number;
  kkdayNet: number;
  /** 차량 정산에 입력한 비용 (주유·과태료·통행료·엔진오일·기타) */
  vehicleExpenses: number;
  cost: number;
  /** 기사 지급액 (세액 포함 = 금액 − 비용) */
  driverPay: number;
  /** 차량별 월정산에서 자동 계산한 비용·기사 지급 (직접 고친 값이 있으면 cost·driverPay 와 다르다) */
  costAuto: number;
  driverPayAuto: number;
  costOverridden: boolean;
  driverPayOverridden: boolean;
  installment: number;
  cashExpense: number;
  cashSpend: number;
  officeExpense: number;
  memo: string | null;
  /** 상세 내역이 있는 항목 (정산표에서는 상세 합계를 보여주고 직접 입력을 막는다) */
  itemized: Record<LedgerCategory, boolean>;
  items: LedgerItem[];
  remain: number;
};

/** 정산내역서·확정 배차·차량별 월정산 비용·직접 입력이 있는 달, 최신 달 먼저 */
export async function ledgerMonths(db: SupabaseClient): Promise<string[]> {
  // 한 번에 1,000건까지만 오므로 끝까지 받는다 (직접 추가 항목은 너무 많아 비용 행으로 달을 찾는다)
  const [st, runs, { data: led }, vExp] = await Promise.all([
    fetchAll((a, b) => db.from("kkday_statements").select("booking_no,service_date").order("booking_no").range(a, b)),
    fetchAll((a, b) => db.from("dispatch_runs").select("id,service_date").eq("status", "confirmed").order("id").range(a, b)),
    db.from("monthly_ledger").select("month"),
    fetchAll((a, b) => db.from("vehicle_month_expenses").select("vehicle_id,month,operator").order("vehicle_id").order("month").order("operator").range(a, b)),
  ]);
  const set = new Set<string>();
  for (const r of st as { service_date: string | null }[]) if (r.service_date) set.add(r.service_date.slice(0, 7));
  for (const r of runs as { service_date: string }[]) set.add(String(r.service_date).slice(0, 7));
  for (const r of [...(led ?? []), ...(vExp as { month: string }[])]) set.add(String(r.month));
  return [...set].sort().reverse();
}

export async function loadMonthLedger(db: SupabaseClient, month: string): Promise<MonthLedger> {
  const { from, to } = monthRange(month);
  const [st, report, { data: led }, { data: itemRows, error: iErr }, { data: manualKk, error: mErr }] = await Promise.all([
    fetchAll((a, b) => db.from("kkday_statements").select("booking_no,amount").gte("service_date", from).lte("service_date", to).order("booking_no").range(a, b)),
    loadVehicleMonth(db, month),
    db.from("monthly_ledger").select("*").eq("month", month).maybeSingle(),
    db.from("monthly_ledger_items").select("*").eq("month", month).order("spent_on", { nullsFirst: false }).order("created_at"),
    // 예약번호 없이 직접 넣은 외부 콜의 KKday 금액 (정산내역서에 없는 금액)
    db.from("bookings").select("raw").gte("service_date", from).lte("service_date", to).is("booking_no", null).not("raw->kkday_amount", "is", null),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (iErr) throw new Error(iErr.message);
  const items = (itemRows ?? []) as LedgerItem[];
  const valueOf = (c: (typeof LEDGER_CATEGORIES)[number]) => {
    const list = items.filter((i) => i.category === c.key);
    return list.length ? list.reduce((s, i) => s + i.amount, 0) : ((led?.[c.column] as number | undefined) ?? 0);
  };
  const [installment, cashExpense, cashSpend, officeExpense] = LEDGER_CATEGORIES.map(valueOf);
  const itemized = Object.fromEntries(LEDGER_CATEGORIES.map((c) => [c.key, items.some((i) => i.category === c.key)])) as Record<LedgerCategory, boolean>;
  const manualKkday = (manualKk ?? []).reduce((s, b) => s + (Number((b.raw as Record<string, unknown> | null)?.kkday_amount) || 0), 0);
  const kkdayStatement = (st as { amount: number }[]).reduce((s, r) => s + r.amount, 0) + manualKkday;
  const kkdayAdjust = led?.kkday_adjust ?? 0;
  const kkdayAmount = kkdayStatement + kkdayAdjust;
  const kkdayNet = withoutVat(kkdayAmount);
  const vehicleExpenses = report.vehicles.reduce((s, v) => s + v.payout.expenses, 0);
  const driverPayAuto = report.vehicles.reduce((s, v) => s + v.payout.diff, 0);
  const costAuto = vehicleExpenses;
  const costOverridden = led?.cost_override != null;
  const driverPayOverridden = led?.driver_pay_override != null;
  const cost = costOverridden ? (led!.cost_override as number) : costAuto;
  const driverPay = driverPayOverridden ? (led!.driver_pay_override as number) : driverPayAuto;
  return {
    month, kkdayAmount, kkdayStatement, kkdayAdjust, kkdayNet, vehicleExpenses, cost, driverPay, costAuto, driverPayAuto, costOverridden, driverPayOverridden,
    installment, cashExpense, cashSpend, officeExpense, memo: led?.memo ?? null, itemized, items,
    remain: kkdayNet - cost - driverPay - installment - cashExpense - cashSpend - officeExpense,
  };
}
