import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { monthRange } from "@/lib/format";
import { withoutVat } from "@/lib/kkday/statement";
import { loadVehicleMonth } from "./vehicleMonthlyLoad";

export type MonthLedger = {
  month: string;
  /** KKday 정산내역서 합계 (실제로 정산 받은 금액, 부가세 포함) */
  kkdayAmount: number;
  kkdayNet: number;
  /** 차량 정산에 입력한 비용 (주유·과태료·통행료·엔진오일·기타) */
  vehicleExpenses: number;
  /** 외부로 준 콜 비용 */
  externalFare: number;
  cost: number;
  /** 기사 지급액 (세액 포함 = 금액 − 비용) */
  driverPay: number;
  installment: number;
  cashExpense: number;
  officeExpense: number;
  memo: string | null;
  remain: number;
};

/** 정산내역서·확정 배차·직접 입력이 있는 달, 최신 달 먼저 */
export async function ledgerMonths(db: SupabaseClient): Promise<string[]> {
  const [st, { data: runs }, { data: led }] = await Promise.all([
    fetchAll((a, b) => db.from("kkday_statements").select("booking_no,service_date").order("booking_no").range(a, b)),
    db.from("dispatch_runs").select("service_date").eq("status", "confirmed"),
    db.from("monthly_ledger").select("month"),
  ]);
  const set = new Set<string>();
  for (const r of st as { service_date: string | null }[]) if (r.service_date) set.add(r.service_date.slice(0, 7));
  for (const r of runs ?? []) set.add(String(r.service_date).slice(0, 7));
  for (const r of led ?? []) set.add(String(r.month));
  return [...set].sort().reverse();
}

export async function loadMonthLedger(db: SupabaseClient, month: string): Promise<MonthLedger> {
  const { from, to } = monthRange(month);
  const [st, report, { data: led }] = await Promise.all([
    fetchAll((a, b) => db.from("kkday_statements").select("booking_no,amount").gte("service_date", from).lte("service_date", to).order("booking_no").range(a, b)),
    loadVehicleMonth(db, month),
    db.from("monthly_ledger").select("*").eq("month", month).maybeSingle(),
  ]);
  const kkdayAmount = (st as { amount: number }[]).reduce((s, r) => s + r.amount, 0);
  const kkdayNet = withoutVat(kkdayAmount);
  const vehicleExpenses = report.vehicles.reduce((s, v) => s + v.payout.expenses, 0);
  const externalFare = report.external.reduce((s, d) => s + d.fare, 0);
  const driverPay = report.vehicles.reduce((s, v) => s + v.payout.diff, 0);
  const installment = led?.vehicle_installment ?? 0;
  const cashExpense = led?.cash_expense ?? 0;
  const officeExpense = led?.office_expense ?? 0;
  const cost = vehicleExpenses + externalFare;
  return {
    month, kkdayAmount, kkdayNet, vehicleExpenses, externalFare, cost, driverPay,
    installment, cashExpense, officeExpense, memo: led?.memo ?? null,
    remain: kkdayNet - cost - driverPay - installment - cashExpense - officeExpense,
  };
}
