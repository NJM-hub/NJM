import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 예약이 하나도 남지 않은 날짜의 배차 기록(초안·확정)을 지운다 */
export async function dropEmptyRuns(db: SupabaseClient, dates: string[]) {
  for (const d of [...new Set(dates.filter(Boolean))]) {
    const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("service_date", d);
    if (!count) await db.from("dispatch_runs").delete().eq("service_date", d);
  }
}
