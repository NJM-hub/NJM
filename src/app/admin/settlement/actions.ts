"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";
import { isMonth } from "@/lib/format";

const won = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[,\s원]/g, "") || 0);
  if (!Number.isFinite(n) || Math.abs(n) > 2_000_000_000) throw new Error("금액이 올바르지 않습니다.");
  return Math.round(n);
};

/** 월별 정산표의 직접 입력 지출 저장 */
export async function saveMonthLedger(formData: FormData) {
  const { supabase } = await assertOwner();
  const month = String(formData.get("month"));
  if (!isMonth(month)) throw new Error("정산 월이 올바르지 않습니다.");
  const { error } = await supabase.from("monthly_ledger").upsert({
    month,
    vehicle_installment: won(formData.get("vehicle_installment")),
    cash_expense: won(formData.get("cash_expense")),
    cash_spend: won(formData.get("cash_spend")),
    office_expense: won(formData.get("office_expense")),
    memo: String(formData.get("memo") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settlement");
}
