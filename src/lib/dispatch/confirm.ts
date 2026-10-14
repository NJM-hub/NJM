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

/** KST 기준 날짜를 days 만큼 옮긴다 (YYYY-MM-DD) */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 날짜가 지났는데(그날 밤 12시) 아직 확정하지 않은 배차를 자동 확정한다.
 * 확정본이 없는 날짜만, 가장 최근 초안을 확정한다. 최근 lookbackDays 일까지 살펴본다.
 */
export async function autoConfirmPastRuns(db: SupabaseClient, today: string, lookbackDays = 7) {
  const from = shiftDate(today, -lookbackDays);
  const { data: runs, error } = await db
    .from("dispatch_runs")
    .select("id,service_date,status,created_at")
    .gte("service_date", from)
    .lt("service_date", today)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const confirmedDates = new Set((runs ?? []).filter((r) => r.status === "confirmed").map((r) => r.service_date as string));
  const done: string[] = [];
  for (const r of runs ?? []) {
    const d = r.service_date as string;
    if (r.status !== "draft" || confirmedDates.has(d)) continue;
    await confirmRunWith(db, r.id as string);
    confirmedDates.add(d);
    done.push(d);
  }
  return done.sort();
}
