"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasLinkedRepayments, regenerateSchedule } from "@/lib/ledger";
import { db } from "@/lib/supabase";
import type { FormState } from "@/lib/types";
import { isInvestmentStatus, parseInvestmentForm, type CustomerInput } from "@/lib/validate";

type Db = ReturnType<typeof db>;

/** 기존 고객이면 그 id, 신규면 같은 이름·연락처 고객을 찾아 재사용하고 없으면 새로 만든다 */
async function resolveCustomerId(supabase: Db, c: CustomerInput): Promise<string> {
  if (c.mode === "existing") return c.customerId;

  const { data: found, error: findError } = await supabase
    .from("customers")
    .select("id")
    .eq("name", c.name)
    .eq("phone", c.phone)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (found) return found.id;

  const { data, error } = await supabase.from("customers").insert({ name: c.name, phone: c.phone }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

function friendlyError(message: string): FormState {
  if (message.includes("investments_investment_no_key")) {
    return { fieldErrors: { investment_no: "이미 사용 중인 투자번호입니다. 다른 번호를 입력하거나 비워두세요." } };
  }
  return { error: `저장하지 못했습니다: ${message}` };
}

export async function createInvestment(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseInvestmentForm(fd);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const v = parsed.data;
  const supabase = db();

  let newId: string;
  try {
    const customerId = await resolveCustomerId(supabase, v.customer);
    const { data, error } = await supabase
      .from("investments")
      .insert({
        ...(v.investmentNo ? { investment_no: v.investmentNo } : {}),
        customer_id: customerId,
        target_name: v.targetName,
        executed_on: v.executedOn,
        principal: v.principal,
        return_rate: v.returnRate,
        repayment_method: v.repaymentMethod,
        period_days: v.periodDays,
        start_on: v.startOn,
        maturity_on: v.maturityOn,
        memo: v.memo,
      })
      .select("id")
      .single();
    if (error) return friendlyError(error.message);
    newId = data.id;
  } catch (e) {
    return friendlyError((e as Error).message);
  }

  // 회수계획 자동 생성 (실패해도 투자 등록은 유지, 상세 화면에서 다시 만들 수 있음)
  let msg = "saved";
  try {
    await regenerateSchedule(supabase, newId);
  } catch {
    msg = "schedule_failed";
  }

  revalidatePath("/", "layout");
  redirect(`/investments/${newId}?msg=${msg}`);
}

export async function updateInvestment(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseInvestmentForm(fd);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const v = parsed.data;
  const supabase = db();

  let msg = "saved";
  try {
    const { data: before, error: beforeError } = await supabase
      .from("investments")
      .select("principal, return_rate, repayment_method, start_on, maturity_on")
      .eq("id", id)
      .single();
    if (beforeError) return friendlyError(beforeError.message);

    const customerId = await resolveCustomerId(supabase, v.customer);
    const { error } = await supabase
      .from("investments")
      .update({
        ...(v.investmentNo ? { investment_no: v.investmentNo } : {}),
        customer_id: customerId,
        target_name: v.targetName,
        executed_on: v.executedOn,
        principal: v.principal,
        return_rate: v.returnRate,
        repayment_method: v.repaymentMethod,
        period_days: v.periodDays,
        start_on: v.startOn,
        maturity_on: v.maturityOn,
        memo: v.memo,
      })
      .eq("id", id);
    if (error) return friendlyError(error.message);

    // 금액·수익률·방식·기간이 바뀌면 회수계획도 새로 만든다 (이미 입금이 연결돼 있으면 그대로 둠)
    const termsChanged =
      Number(before.principal) !== v.principal ||
      Number(before.return_rate) !== v.returnRate ||
      before.repayment_method !== v.repaymentMethod ||
      before.start_on !== v.startOn ||
      before.maturity_on !== v.maturityOn;
    if (termsChanged) {
      if (await hasLinkedRepayments(supabase, id)) msg = "schedule_kept";
      else {
        await regenerateSchedule(supabase, id);
        msg = "schedule";
      }
    }
  } catch (e) {
    return friendlyError((e as Error).message);
  }

  revalidatePath("/", "layout");
  redirect(`/investments/${id}?msg=${msg}`);
}

/** 상태 변경 (삭제 대신 '취소'로 바꾼다) */
export async function changeInvestmentStatus(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const status = String(fd.get("status") ?? "");
  const reason = String(fd.get("status_reason") ?? "").trim();
  if (!isInvestmentStatus(status)) return { error: "상태를 선택하세요." };
  if (status === "cancelled" && !reason) return { error: "취소 사유를 입력하세요." };

  const { error } = await db().from("investments").update({ status, status_reason: reason }).eq("id", id);
  if (error) return { error: `상태를 바꾸지 못했습니다: ${error.message}` };

  revalidatePath("/", "layout");
  redirect(`/investments/${id}?msg=status`);
}
