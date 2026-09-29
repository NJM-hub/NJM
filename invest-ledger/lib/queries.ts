import "server-only";
import { db } from "@/lib/supabase";
import type { Customer, InvestmentSummary, Repayment, ScheduleRow } from "@/lib/types";

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 중 오류가 발생했습니다: ${error.message}`);
}

/** numeric 컬럼이 문자열로 올 때를 대비해 숫자로 변환 */
const NUMERIC_KEYS = [
  "principal", "return_rate", "expected_total", "collected_amount", "remaining_amount",
  "recovery_rate", "overdue_amount", "overdue_count", "schedule_count", "elapsed_days", "remaining_days",
] as const;

function toSummary(row: Record<string, unknown>): InvestmentSummary {
  const r = { ...row };
  for (const k of NUMERIC_KEYS) r[k] = Number(r[k] ?? 0);
  return r as InvestmentSummary;
}

export async function listInvestments(opts: { includeCancelled?: boolean } = {}): Promise<InvestmentSummary[]> {
  let q = db().from("v_investment_summary").select("*").order("executed_on", { ascending: false }).order("investment_no", { ascending: false });
  if (!opts.includeCancelled) q = q.neq("status", "cancelled");
  const { data, error } = await q;
  if (error) fail("투자 목록 조회", error);
  return (data ?? []).map(toSummary);
}

export async function getInvestment(id: string): Promise<InvestmentSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("v_investment_summary").select("*").eq("id", id).maybeSingle();
  if (error) fail("투자 정보 조회", error);
  return data ? toSummary(data) : null;
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await db().from("customers").select("*").eq("status", "active").order("name");
  if (error) fail("고객 목록 조회", error);
  return data ?? [];
}

export async function getSchedules(investmentId: string): Promise<ScheduleRow[]> {
  const { data, error } = await db()
    .from("v_schedule_status")
    .select("*")
    .eq("investment_id", investmentId)
    .order("due_date")
    .order("seq");
  if (error) fail("회수계획 조회", error);
  return (data ?? []).map((r) => ({
    ...r,
    planned_amount: Number(r.planned_amount),
    paid_amount: Number(r.paid_amount),
    unpaid_amount: Number(r.unpaid_amount),
  }));
}

export async function getSchedule(id: string): Promise<ScheduleRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("v_schedule_status").select("*").eq("id", id).maybeSingle();
  if (error) fail("회차 조회", error);
  return data
    ? { ...data, planned_amount: Number(data.planned_amount), paid_amount: Number(data.paid_amount), unpaid_amount: Number(data.unpaid_amount) }
    : null;
}

export async function getRepayments(investmentId: string): Promise<Repayment[]> {
  const { data, error } = await db()
    .from("repayments")
    .select("*")
    .eq("investment_id", investmentId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail("회수내역 조회", error);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
}
