import "server-only";
import { buildSchedule } from "@/lib/schedule";
import type { db } from "@/lib/supabase";

type Db = ReturnType<typeof db>;

/** 회수계획에 연결된 유효 입금이 있는지 (있으면 계획을 새로 만들 수 없음) */
export async function hasLinkedRepayments(supabase: Db, investmentId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("repayments")
    .select("id", { count: "exact", head: true })
    .eq("investment_id", investmentId)
    .eq("status", "valid")
    .not("schedule_id", "is", null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * 투자 조건(시작일·만기일·회수방식·총 회수 예정금액)으로 회수계획을 새로 만든다.
 * 기존 회차는 삭제하지 않고 status=void 로 남긴다.
 */
export async function regenerateSchedule(supabase: Db, investmentId: string): Promise<number> {
  const { data: inv, error } = await supabase
    .from("investments")
    .select("start_on, maturity_on, repayment_method, expected_total")
    .eq("id", investmentId)
    .single();
  if (error) throw new Error(error.message);

  if (await hasLinkedRepayments(supabase, investmentId)) {
    throw new Error("이미 회차에 연결된 입금 기록이 있어 회수계획을 새로 만들 수 없습니다. 회차를 하나씩 수정하거나 추가하세요.");
  }

  const rows = buildSchedule({
    startOn: inv.start_on,
    maturityOn: inv.maturity_on,
    method: inv.repayment_method,
    total: Number(inv.expected_total),
  });

  const { data: old, error: voidError } = await supabase
    .from("repayment_schedules")
    .update({ status: "void" })
    .eq("investment_id", investmentId)
    .eq("status", "active")
    .select("id");
  if (voidError) throw new Error(voidError.message);

  const { error: insertError } = await supabase.from("repayment_schedules").insert(
    rows.map((r) => ({ investment_id: investmentId, seq: r.seq, due_date: r.dueDate, planned_amount: r.amount })),
  );
  if (insertError) {
    // 새 계획 저장에 실패하면 기존 계획을 되살린다
    const ids = (old ?? []).map((o) => o.id);
    if (ids.length) await supabase.from("repayment_schedules").update({ status: "active" }).in("id", ids);
    throw new Error(insertError.message);
  }
  return rows.length;
}

/** 다 받으면 '완료', 입금 취소로 다시 남으면 '진행중'으로 상태를 맞춘다 (보류·취소 건은 그대로) */
export async function syncCompletion(supabase: Db, investmentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("v_investment_summary")
    .select("status, remaining_amount")
    .eq("id", investmentId)
    .single();
  if (error) throw new Error(error.message);
  const remaining = Number(data.remaining_amount);
  if (data.status === "active" && remaining <= 0) {
    await supabase.from("investments").update({ status: "completed", status_reason: "전액 회수 (자동)" }).eq("id", investmentId);
  } else if (data.status === "completed" && remaining > 0) {
    await supabase.from("investments").update({ status: "active", status_reason: "" }).eq("id", investmentId);
  }
}
