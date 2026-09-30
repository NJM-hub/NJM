import "server-only";
import { db } from "@/lib/supabase";
import type { DueRow, PaidRow } from "@/lib/stats";
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

// ─────────────────────── 대시보드·통계용 ───────────────────────
// Supabase 는 한 번에 최대 1,000행까지 돌려주므로 나눠서 모두 가져온다.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  // 서버 설정에 따라 한 번에 주는 개수가 더 적을 수 있으니, 빈 결과가 올 때까지 받은 만큼 넘겨가며 읽는다
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + size - 1);
    if (error) fail(what, error);
    if (!data || data.length === 0) return out;
    out.push(...data);
    from += data.length;
  }
}

/** 전체 투자 (취소 포함) */
export async function listAllInvestments(): Promise<InvestmentSummary[]> {
  const rows = await fetchAll<Record<string, unknown>>(
    (a, b) => db().from("v_investment_summary").select("*").order("id").range(a, b),
    "투자 조회",
  );
  return rows.map(toSummary);
}

/** 기간 안에 예정된 회차 */
export async function listSchedulesBetween(from: string, to: string): Promise<DueRow[]> {
  const rows = await fetchAll<DueRow>(
    (a, b) =>
      db()
        .from("v_schedule_status")
        .select("investment_id, due_date, planned_amount, unpaid_amount")
        .gte("due_date", from)
        .lte("due_date", to)
        .order("id")
        .range(a, b),
    "회수계획 조회",
  );
  return rows.map((r) => ({ ...r, planned_amount: Number(r.planned_amount), unpaid_amount: Number(r.unpaid_amount) }));
}

/** 기간 안의 실제 입금 (취소된 입금 제외) */
export async function listPaymentsBetween(from: string, to: string): Promise<PaidRow[]> {
  const rows = await fetchAll<PaidRow>(
    (a, b) =>
      db()
        .from("repayments")
        .select("investment_id, paid_on, amount")
        .eq("status", "valid")
        .gte("paid_on", from)
        .lte("paid_on", to)
        .order("id")
        .range(a, b),
    "입금 조회",
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** 고객 전체 (미사용 고객 포함) */
export async function listAllCustomers(): Promise<Customer[]> {
  return fetchAll<Customer>((a, b) => db().from("customers").select("*").order("id").range(a, b), "고객 조회");
}

export async function getCustomer(id: string): Promise<Customer | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("customers").select("*").eq("id", id).maybeSingle();
  if (error) fail("고객 조회", error);
  return data;
}

export async function listCustomerInvestments(customerId: string): Promise<InvestmentSummary[]> {
  const { data, error } = await db()
    .from("v_investment_summary")
    .select("*")
    .eq("customer_id", customerId)
    .order("executed_on", { ascending: false });
  if (error) fail("고객 투자 조회", error);
  return (data ?? []).map(toSummary);
}
