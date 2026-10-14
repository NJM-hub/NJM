import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 배차를 확정한다: 확정 시점의 차량-기사 연결로 기사 정보를 채우고,
 * 같은 날짜의 기존 확정본은 초안으로 돌린 뒤 이 배차를 확정한다.
 */
export async function confirmRunWith(db: SupabaseClient, runId: string): Promise<{ serviceDate: string }> {
  const { data: run } = await db.from("dispatch_runs").select("id,service_date").eq("id", runId).single();
  if (!run) throw new Error("배차를 찾을 수 없습니다.");

  const { data: drivers } = await db.from("drivers").select("id,vehicle_id").eq("status", "approved").not("vehicle_id", "is", null);
  const { data: rows } = await db.from("dispatch_assignments").select("id,vehicle_id").eq("run_id", runId).not("vehicle_id", "is", null);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id as string, d.id as string]));
  await Promise.all(
    (rows ?? []).map((r) => db.from("dispatch_assignments").update({ driver_id: driverOf.get(r.vehicle_id!) ?? null }).eq("id", r.id)),
  );

  await db.from("dispatch_runs").update({ status: "draft", confirmed_at: null }).eq("service_date", run.service_date).eq("status", "confirmed");
  const { error } = await db.from("dispatch_runs").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw new Error(error.message);
  return { serviceDate: run.service_date as string };
}
