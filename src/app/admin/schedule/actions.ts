"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { isDate } from "@/lib/format";
import { DELETE_ALL_WORD } from "./constants";

type Db = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

export type DeleteResult = { ok: true; message: string } | { ok: false; message: string } | null;

function refresh() {
  for (const p of ["/admin", "/admin/upload", "/admin/dispatch", "/admin/vehicle-settlement"]) revalidatePath(p);
}

/** 예약이 하나도 남지 않은 날짜의 배차 기록(초안·확정)을 지운다 */
async function dropEmptyRuns(db: Db, dates: string[]) {
  for (const d of [...new Set(dates)]) {
    const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", d);
    if (!count) await db.from("dispatch_runs").delete().eq("service_date", d);
  }
}

/** 한 날짜의 예약과 배차를 모두 삭제 */
export async function deleteDate(_prev: DeleteResult, formData: FormData): Promise<DeleteResult> {
  const { supabase } = await assertAdmin();
  const date = String(formData.get("date"));
  if (!isDate(date)) return { ok: false, message: "날짜가 올바르지 않습니다." };
  const { error: e1, count } = await supabase.from("bookings").delete({ count: "exact" }).eq("service_date", date);
  if (e1) return { ok: false, message: e1.message };
  const { error: e2 } = await supabase.from("dispatch_runs").delete().eq("service_date", date);
  if (e2) return { ok: false, message: e2.message };
  refresh();
  return { ok: true, message: `${date} 일정 ${count ?? 0}건과 배차를 삭제했습니다.` };
}

/** 업로드한 파일 하나로 들어온 예약을 삭제 */
export async function deleteUpload(_prev: DeleteResult, formData: FormData): Promise<DeleteResult> {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("uploadId"));
  const { data: rows } = await supabase.from("bookings").select("service_date").eq("upload_id", id);
  const { error: e1, count } = await supabase.from("bookings").delete({ count: "exact" }).eq("upload_id", id);
  if (e1) return { ok: false, message: e1.message };
  const { error: e2 } = await supabase.from("schedule_uploads").delete().eq("id", id);
  if (e2) return { ok: false, message: e2.message };
  await dropEmptyRuns(supabase, (rows ?? []).map((r) => r.service_date as string).filter(Boolean));
  refresh();
  return { ok: true, message: `업로드 파일의 예약 ${count ?? 0}건을 삭제했습니다.` };
}

/** 예약 한 건 삭제 (배차에서도 빠진다) */
export async function deleteBooking(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("bookingId"));
  const { data: b } = await supabase.from("bookings").select("service_date").eq("id", id).maybeSingle();
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (b?.service_date) await dropEmptyRuns(supabase, [b.service_date]);
  refresh();
}

/** 모든 배차 일정(업로드 기록, 예약, 배차) 삭제. 차량·기사·설정·정산 비용은 남긴다 */
export async function deleteAllSchedules(_prev: DeleteResult, formData: FormData): Promise<DeleteResult> {
  const { supabase } = await assertAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== DELETE_ALL_WORD) {
    return { ok: false, message: `확인란에 "${DELETE_ALL_WORD}"라고 입력해야 삭제됩니다.` };
  }
  const { error: e1 } = await supabase.from("dispatch_runs").delete().not("id", "is", null);
  if (e1) return { ok: false, message: e1.message };
  const { error: e2, count } = await supabase.from("bookings").delete({ count: "exact" }).not("id", "is", null);
  if (e2) return { ok: false, message: e2.message };
  const { error: e3 } = await supabase.from("schedule_uploads").delete().not("id", "is", null);
  if (e3) return { ok: false, message: e3.message };
  refresh();
  return { ok: true, message: `모든 배차 일정(예약 ${count ?? 0}건)을 삭제했습니다.` };
}
