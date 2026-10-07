"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import type { StatementBooking } from "@/lib/kkday/statement";

export type StatementSaveResult = { ok: true; count: number } | { ok: false; error: string };

/** KKday 정산내역서(예약번호별 금액)를 저장한다. 같은 예약번호는 새 내역서 값으로 바꾼다 */
export async function saveKkdayStatement(items: StatementBooking[]): Promise<StatementSaveResult> {
  const { supabase } = await assertAdmin();
  const rows = items
    .filter((b) => b.bookingNo && Number.isFinite(b.amount))
    .map((b) => ({
      booking_no: b.bookingNo.slice(0, 40),
      amount: Math.round(b.amount),
      lines: b.lines,
      service_date: /^\d{4}-\d{2}-\d{2}$/.test(b.serviceDate ?? "") ? b.serviceDate : null,
      status: b.status?.slice(0, 40) ?? null,
      uploaded_at: new Date().toISOString(),
    }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("kkday_statements").upsert(rows.slice(i, i + 500), { onConflict: "booking_no" });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/external-calls");
  return { ok: true, count: rows.length };
}
