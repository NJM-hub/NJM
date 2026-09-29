"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { isDate } from "@/lib/dates";
import { parseMoney } from "@/lib/format";
import { regenerateSchedule, syncCompletion } from "@/lib/ledger";
import { allocatePayment } from "@/lib/schedule";
import { db } from "@/lib/supabase";
import type { FormState } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function done(investmentId: string, msg: string): never {
  revalidatePath("/", "layout");
  redirect(`/investments/${investmentId}?msg=${msg}`);
}

/** 회수계획 만들기 / 다시 만들기 */
export async function generateScheduleAction(investmentId: string): Promise<FormState> {
  try {
    const a = await authorize("staff");
    if ("denied" in a) return a.denied;
    const supabase = db(a.user.id);
    // 처음 만들기는 직원도 가능, 이미 있는 계획을 다시 만드는 것은 관리자만
    const { count } = await supabase
      .from("repayment_schedules")
      .select("id", { count: "exact", head: true })
      .eq("investment_id", investmentId)
      .eq("status", "active");
    if ((count ?? 0) > 0 && a.user.role !== "admin") return { error: "회수계획 다시 만들기는 관리자만 할 수 있습니다." };
    await regenerateSchedule(supabase, investmentId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  done(investmentId, "schedule");
}

/** 입금 등록: 자동 배분(오래된 회차부터) 또는 특정 회차 지정 */
export async function recordPaymentAction(investmentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const paidOn = str(fd, "paid_on");
  const amount = parseMoney(str(fd, "amount"));
  const mode = str(fd, "mode");
  const scheduleId = str(fd, "schedule_id");
  const memo = str(fd, "memo");

  const fieldErrors: Record<string, string> = {};
  if (!isDate(paidOn)) fieldErrors.paid_on = "입금일을 선택하세요.";
  if (!(amount > 0)) fieldErrors.amount = "입금액을 숫자로 입력하세요.";
  if (mode === "schedule" && !scheduleId) fieldErrors.schedule_id = "회차를 선택하세요.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const supabase = db(a.user.id);
  const { data: schedules, error } = await supabase
    .from("v_schedule_status")
    .select("id, seq, due_date, unpaid_amount")
    .eq("investment_id", investmentId);
  if (error) return { error: error.message };
  const unpaid = (schedules ?? []).map((s) => ({ ...s, unpaid_amount: Number(s.unpaid_amount) }));

  let allocations;
  if (mode === "schedule") {
    const target = unpaid.find((s) => s.id === scheduleId);
    if (!target) return { fieldErrors: { schedule_id: "선택한 회차를 찾을 수 없습니다." } };
    if (amount > target.unpaid_amount) {
      return {
        fieldErrors: {
          amount: `${target.seq}회차 미회수금액(${target.unpaid_amount.toLocaleString("ko-KR")}원)보다 많습니다. '자동 배분'을 선택하면 다음 회차로 나눠 기록됩니다.`,
        },
      };
    }
    allocations = [{ scheduleId, amount }];
  } else {
    allocations = allocatePayment(unpaid, amount);
  }

  const { error: insertError } = await supabase.from("repayments").insert(
    allocations.map((a) => ({ investment_id: investmentId, schedule_id: a.scheduleId, paid_on: paidOn, amount: a.amount, memo })),
  );
  if (insertError) return { error: `저장하지 못했습니다: ${insertError.message}` };

  await syncCompletion(supabase, investmentId);
  done(investmentId, "paid");
}

/** 한 회차 완납 처리 (미회수금액 전액을 입금일로 기록) */
export async function quickPayAction(investmentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const scheduleId = str(fd, "schedule_id");
  const paidOn = str(fd, "paid_on");
  if (!isDate(paidOn)) return { error: "입금일이 올바르지 않습니다." };

  const a = await authorize("staff");
  if ("denied" in a) return a.denied;
  const supabase = db(a.user.id);
  const { data: s, error } = await supabase
    .from("v_schedule_status")
    .select("unpaid_amount")
    .eq("id", scheduleId)
    .eq("investment_id", investmentId)
    .single();
  if (error) return { error: error.message };
  const unpaid = Number(s.unpaid_amount);
  if (unpaid <= 0) return { error: "이미 완납된 회차입니다." };

  const { error: insertError } = await supabase
    .from("repayments")
    .insert({ investment_id: investmentId, schedule_id: scheduleId, paid_on: paidOn, amount: unpaid });
  if (insertError) return { error: insertError.message };

  await syncCompletion(supabase, investmentId);
  done(investmentId, "paid");
}

/** 입금 기록 취소 (삭제하지 않고 무효 처리) */
export async function voidRepaymentAction(investmentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const repaymentId = str(fd, "repayment_id");
  const reason = str(fd, "void_reason");
  if (!reason) return { error: "취소 사유를 입력하세요." };

  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const supabase = db(a.user.id);
  const { error } = await supabase
    .from("repayments")
    .update({ status: "void", void_reason: reason })
    .eq("id", repaymentId)
    .eq("investment_id", investmentId);
  if (error) return { error: error.message };

  await syncCompletion(supabase, investmentId);
  done(investmentId, "void");
}

function parseScheduleForm(fd: FormData) {
  const dueDate = str(fd, "due_date");
  const planned = parseMoney(str(fd, "planned_amount"));
  const fieldErrors: Record<string, string> = {};
  if (!isDate(dueDate)) fieldErrors.due_date = "예정 회수일을 선택하세요.";
  if (!(planned >= 0)) fieldErrors.planned_amount = "예정 회수금액을 숫자로 입력하세요.";
  return { dueDate, planned, memo: str(fd, "memo"), fieldErrors };
}

/** 회차 수정 (예정일·예정금액·메모) */
export async function updateScheduleAction(
  investmentId: string,
  scheduleId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const v = parseScheduleForm(fd);
  if (Object.keys(v.fieldErrors).length) return { fieldErrors: v.fieldErrors };
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;

  const { error } = await db(a.user.id)
    .from("repayment_schedules")
    .update({ due_date: v.dueDate, planned_amount: v.planned, memo: v.memo })
    .eq("id", scheduleId)
    .eq("investment_id", investmentId);
  if (error) return { error: error.message };
  done(investmentId, "schedule_saved");
}

/** 회차 추가 (연장·추가 회수 등) */
export async function addScheduleAction(investmentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const v = parseScheduleForm(fd);
  if (Object.keys(v.fieldErrors).length) return { fieldErrors: v.fieldErrors };
  const a = await authorize("staff");
  if ("denied" in a) return a.denied;

  const supabase = db(a.user.id);
  const { data: last, error: seqError } = await supabase
    .from("repayment_schedules")
    .select("seq")
    .eq("investment_id", investmentId)
    .eq("status", "active")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seqError) return { error: seqError.message };

  const { error } = await supabase.from("repayment_schedules").insert({
    investment_id: investmentId,
    seq: (last?.seq ?? 0) + 1,
    due_date: v.dueDate,
    planned_amount: v.planned,
    memo: v.memo,
  });
  if (error) return { error: error.message };
  done(investmentId, "schedule_saved");
}
