"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isInvestmentStatus } from "@/lib/constants";
import { formValues, parseInvestmentForm, type FormState, type InvestmentInput } from "@/lib/investmentForm";
import { db } from "@/lib/supabase/server";

/**
 * 고객 찾기 또는 만들기
 * - 같은 이름 + 같은 연락처 고객이 있으면 그 고객을 사용
 * - 수정 중이고 이름이 기존 고객과 같으면 기존 고객의 연락처를 새 값으로 변경
 * - 그 외에는 새 고객을 만듦
 */
async function resolveCustomer(input: InvestmentInput, currentCustomerId?: string): Promise<string> {
  const supabase = db();

  let query = supabase.from("customers").select("id").eq("name", input.customer_name).limit(1);
  query = input.customer_phone ? query.eq("phone", input.customer_phone) : query.is("phone", null);
  const { data: found, error: findError } = await query;
  if (findError) throw new Error(findError.message);
  if (found && found.length > 0) return found[0].id as string;

  if (currentCustomerId) {
    const { data: current } = await supabase.from("customers").select("id, name").eq("id", currentCustomerId).single();
    if (current && current.name === input.customer_name) {
      const { error } = await supabase
        .from("customers")
        .update({ phone: input.customer_phone })
        .eq("id", currentCustomerId);
      if (error) throw new Error(error.message);
      return currentCustomerId;
    }
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: input.customer_name, phone: input.customer_phone })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

function investmentRow(input: InvestmentInput, customerId: string) {
  return {
    customer_id: customerId,
    target_name: input.target_name,
    executed_on: input.executed_on,
    principal: input.principal,
    return_rate: input.return_rate,
    repayment_method: input.repayment_method,
    term_days: input.term_days,
    start_on: input.start_on,
    maturity_on: input.maturity_on,
    memo: input.memo,
  };
}

function dbErrorMessage(e: { message?: string; code?: string }): string {
  if (e.code === "23505") return "이미 사용 중인 투자번호입니다. 다른 번호를 입력하거나 비워두세요(자동 부여).";
  return `저장하지 못했습니다: ${e.message ?? "알 수 없는 오류"}`;
}

/** 투자 등록 */
export async function createInvestment(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseInvestmentForm(fd);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, values: formValues(fd), message: "입력값을 확인하세요." };
  const input = parsed.data;

  let newId: string;
  try {
    const customerId = await resolveCustomer(input);
    const { data, error } = await db()
      .from("investments")
      .insert({ ...investmentRow(input, customerId), investment_no: input.investment_no, status: "active" })
      .select("id")
      .single();
    if (error) return { ok: false, message: dbErrorMessage(error), values: formValues(fd) };
    newId = data.id as string;
  } catch (e) {
    return { ok: false, message: dbErrorMessage(e as Error), values: formValues(fd) };
  }

  revalidatePath("/", "layout");
  redirect(`/investments/${newId}?saved=1`);
}

/** 투자 수정 */
export async function updateInvestment(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseInvestmentForm(fd);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, values: formValues(fd), message: "입력값을 확인하세요." };
  const input = parsed.data;

  try {
    const supabase = db();
    const { data: current, error: loadError } = await supabase
      .from("investments")
      .select("customer_id, status")
      .eq("id", id)
      .single();
    if (loadError) return { ok: false, message: dbErrorMessage(loadError), values: formValues(fd) };

    const customerId = await resolveCustomer(input, current.customer_id as string);
    const row: Record<string, unknown> = { ...investmentRow(input, customerId), status: input.status };
    if (input.investment_no) row.investment_no = input.investment_no;
    if (current.status !== input.status) row.status_changed_at = new Date().toISOString();

    const { error } = await supabase.from("investments").update(row).eq("id", id);
    if (error) return { ok: false, message: dbErrorMessage(error), values: formValues(fd) };
  } catch (e) {
    return { ok: false, message: dbErrorMessage(e as Error), values: formValues(fd) };
  }

  revalidatePath("/", "layout");
  redirect(`/investments/${id}?saved=1`);
}

/** 상태만 변경 (완료 처리 / 취소 처리 / 진행중으로 되돌리기). 삭제 대신 사용합니다. */
export async function changeInvestmentStatus(id: string, status: string): Promise<void> {
  if (!isInvestmentStatus(status)) throw new Error("잘못된 상태값");
  const { error } = await db()
    .from("investments")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
