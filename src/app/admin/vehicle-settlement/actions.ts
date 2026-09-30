"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { isMonth } from "@/lib/format";
import { EXPENSE_LABELS } from "@/lib/settlement/vehicleMonthly";

const won = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[,\s원]/g, "") || 0);
  if (!Number.isFinite(n) || Math.abs(n) > 1_000_000_000) throw new Error("금액이 올바르지 않습니다.");
  return Math.round(n);
};

/** 차량 월 비용 (주유·과태료·통행료·엔진오일·기타) */
export async function saveExpenses(formData: FormData) {
  const { supabase } = await assertAdmin();
  const month = String(formData.get("month"));
  const vehicleId = String(formData.get("vehicleId"));
  if (!isMonth(month) || !vehicleId) throw new Error("정산 월/차량이 올바르지 않습니다.");
  const row: Record<string, unknown> = { vehicle_id: vehicleId, month, updated_at: new Date().toISOString() };
  for (const k of Object.keys(EXPENSE_LABELS)) row[k] = won(formData.get(k));
  row.memo = String(formData.get("memo") ?? "").trim() || null;
  const { error } = await supabase.from("vehicle_month_expenses").upsert(row, { onConflict: "vehicle_id,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicle-settlement");
}

/**
 * 건별 정산 금액 수정. 폼에는 amount_<배정id> 와 원래 값 orig_<배정id> 가 있고, 바뀐 것만 저장한다.
 * 비우면 기본값(배차 지급액, 외부오더는 −차감액)으로 되돌린다.
 */
export async function saveAmounts(formData: FormData) {
  const { supabase } = await assertAdmin();
  const updates: { id: string; value: number | null }[] = [];
  for (const [key, v] of formData.entries()) {
    if (!key.startsWith("amount_")) continue;
    const id = key.slice(7);
    const raw = String(v).trim();
    if (raw === String(formData.get(`orig_${id}`) ?? "").trim()) continue;
    updates.push({ id, value: raw === "" ? null : won(raw) });
  }
  const results = await Promise.all(
    updates.map((u) => supabase.from("dispatch_assignments").update({ settle_amount: u.value }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/admin/vehicle-settlement");
}
