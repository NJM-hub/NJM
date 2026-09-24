"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import {
  dispatch,
  simulateRoute,
  type DispatchBooking,
  type DispatchVehicle,
  type DispatchOptions,
} from "@/lib/dispatch/algorithm";
import { isDate } from "@/lib/format";
import { geocodeAddresses } from "@/lib/geocode";
import { dispatchOptionsOf, loadSettings } from "@/lib/settings";

type BookingRow = {
  id: string;
  pickup_at: string | null;
  duration_min: number | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  pax: number;
  fare: number | null;
};

type VehicleRow = {
  id: string;
  seats: number;
  base_address: string | null;
  base_lat: number | null;
  base_lng: number | null;
};

const pt = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null);

function toDispatchBooking(b: BookingRow): DispatchBooking {
  return {
    id: b.id,
    pickupAt: b.pickup_at ? new Date(b.pickup_at).getTime() : null,
    durationMin: b.duration_min,
    pickup: pt(b.pickup_lat, b.pickup_lng),
    dropoff: pt(b.dropoff_lat, b.dropoff_lng),
    pax: b.pax,
  };
}

function toDispatchVehicle(v: VehicleRow): DispatchVehicle {
  return { id: v.id, seats: v.seats, base: pt(v.base_lat, v.base_lng) };
}

/** 좌표가 비어 있는 예약/차고지 주소를 카카오 API 로 채운다 (키가 있을 때만) */
async function fillCoordinates(
  db: Awaited<ReturnType<typeof assertAdmin>>["supabase"],
  bookings: BookingRow[],
  vehicles: VehicleRow[],
) {
  const addrs: string[] = [];
  for (const b of bookings) {
    if (b.pickup_lat == null && b.pickup_address) addrs.push(b.pickup_address);
    if (b.dropoff_lat == null && b.dropoff_address) addrs.push(b.dropoff_address);
  }
  for (const v of vehicles) if (v.base_lat == null && v.base_address) addrs.push(v.base_address);
  if (!addrs.length) return;
  const geo = await geocodeAddresses(db, addrs);
  const lookup = (a: string | null) => (a ? geo.get(a.trim()) ?? null : null);

  const updates: PromiseLike<unknown>[] = [];
  for (const b of bookings) {
    const p = b.pickup_lat == null ? lookup(b.pickup_address) : null;
    const d = b.dropoff_lat == null ? lookup(b.dropoff_address) : null;
    if (!p && !d) continue;
    if (p) [b.pickup_lat, b.pickup_lng] = [p.lat, p.lng];
    if (d) [b.dropoff_lat, b.dropoff_lng] = [d.lat, d.lng];
    updates.push(
      db.from("bookings").update({
        pickup_lat: b.pickup_lat, pickup_lng: b.pickup_lng, dropoff_lat: b.dropoff_lat, dropoff_lng: b.dropoff_lng,
      }).eq("id", b.id),
    );
  }
  for (const v of vehicles) {
    const p = v.base_lat == null ? lookup(v.base_address) : null;
    if (!p) continue;
    [v.base_lat, v.base_lng] = [p.lat, p.lng];
    updates.push(db.from("vehicles").update({ base_lat: p.lat, base_lng: p.lng }).eq("id", v.id));
  }
  await Promise.all(updates);
}

export async function runDispatch(formData: FormData) {
  const { supabase, user } = await assertAdmin();
  const date = String(formData.get("date"));
  if (!isDate(date)) throw new Error("날짜가 올바르지 않습니다.");

  const settings = await loadSettings(supabase);
  const opts: DispatchOptions = dispatchOptionsOf(settings);
  const vehicleIds = formData.getAll("vehicle").map(String);

  const [{ data: bookings, error: bErr }, { data: vehicles, error: vErr }, { data: drivers }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,pickup_at,duration_min,pickup_address,pickup_lat,pickup_lng,dropoff_address,dropoff_lat,dropoff_lng,pax,fare")
      .eq("service_date", date),
    supabase.from("vehicles").select("id,seats,base_address,base_lat,base_lng").eq("active", true).order("plate_number"),
    supabase.from("drivers").select("id,vehicle_id").eq("status", "approved").not("vehicle_id", "is", null),
  ]);
  if (bErr || vErr) throw new Error(bErr?.message ?? vErr?.message);
  if (!bookings?.length) throw new Error("해당 날짜에 예약이 없습니다. 먼저 일정표를 업로드하세요.");

  // 체크된 차량만 사용 (체크 정보가 없으면 전체 운행 가능 차량)
  const usable = (vehicles ?? []).filter((v) => vehicleIds.length === 0 || vehicleIds.includes(v.id));
  if (!usable.length) throw new Error("사용할 차량이 없습니다.");

  await fillCoordinates(supabase, bookings, usable);

  const result = dispatch(bookings.map(toDispatchBooking), usable.map(toDispatchVehicle), opts);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id as string, d.id as string]));
  const fareOf = new Map(bookings.map((b) => [b.id, b.fare ?? settings.fare_per_call]));

  // 같은 날짜의 이전 초안은 정리
  await supabase.from("dispatch_runs").delete().eq("service_date", date).eq("status", "draft");

  const { data: run, error: rErr } = await supabase
    .from("dispatch_runs")
    .insert({
      service_date: date,
      options: { ...opts, vehicleIds: usable.map((v) => v.id) },
      summary: result.summary,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (rErr || !run) throw new Error(rErr?.message ?? "배차 저장 실패");

  const rows = [
    ...result.routes.flatMap((r) =>
      r.stops.map((s) => ({
        run_id: run.id,
        booking_id: s.bookingId,
        vehicle_id: r.vehicleId,
        driver_id: driverOf.get(r.vehicleId) ?? null,
        seq: s.seq,
        ready_at: new Date(s.readyAt).toISOString(),
        deadhead_km: s.deadheadKm,
        deadhead_min: s.deadheadMin,
        fare: fareOf.get(s.bookingId) ?? 0,
      })),
    ),
    ...result.unassigned.map((u) => ({
      run_id: run.id,
      booking_id: u.bookingId,
      vehicle_id: null,
      driver_id: null,
      unassigned_reason: u.reason,
      fare: fareOf.get(u.bookingId) ?? 0,
    })),
  ];
  const { error: aErr } = await supabase.from("dispatch_assignments").insert(rows);
  if (aErr) throw new Error(aErr.message);

  revalidatePath("/admin/dispatch");
  redirect(`/admin/dispatch?date=${date}&run=${run.id}`);
}

/**
 * 배차 결과를 수동으로 옮긴다. 옮긴 뒤 두 차량의 경로를 다시 계산해 순번/공차 정보를 갱신하고
 * 시간상 불가능하면 에러를 돌려준다 (force 면 그대로 저장).
 */
export async function moveAssignment(formData: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(formData.get("assignmentId"));
  const target = String(formData.get("vehicleId") || "") || null;
  const force = formData.get("force") === "1";

  const { data: a, error } = await supabase
    .from("dispatch_assignments")
    .select("id,run_id,vehicle_id,dispatch_runs(status,service_date,options)")
    .eq("id", id)
    .single();
  if (error || !a) throw new Error("배차 정보를 찾을 수 없습니다.");
  const run = a.dispatch_runs as unknown as { status: string; service_date: string; options: DispatchOptions };
  if (run.status !== "draft") throw new Error("확정된 배차는 수정할 수 없습니다. 먼저 확정을 해제하세요.");

  const opts = run.options;
  const affected = [a.vehicle_id, target].filter((v): v is string => !!v);

  const { data: all } = await supabase
    .from("dispatch_assignments")
    .select("id,vehicle_id,booking_id,bookings(id,pickup_at,duration_min,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pax)")
    .eq("run_id", a.run_id);
  const { data: vehicles } = affected.length
    ? await supabase.from("vehicles").select("id,seats,base_address,base_lat,base_lng").in("id", affected)
    : { data: [] as VehicleRow[] };
  const { data: drivers } = target
    ? await supabase.from("drivers").select("id").eq("vehicle_id", target).eq("status", "approved")
    : { data: [] as { id: string }[] };

  const list = (all ?? []).map((x) => ({ ...x, vehicle_id: x.id === id ? target : x.vehicle_id }));
  const updates: { id: string; seq: number; ready_at: string; deadhead_km: number | null; deadhead_min: number }[] = [];
  for (const v of vehicles ?? []) {
    const own = list.filter((x) => x.vehicle_id === v.id);
    const bs = own.map((x) => toDispatchBooking(x.bookings as unknown as BookingRow)).filter((b) => b.pickupAt != null);
    bs.sort((p, q) => p.pickupAt! - q.pickupAt!);
    // 최대 콜 수는 수동 조정에서는 경고만: 한도 없이 시뮬레이션
    const stops = simulateRoute(toDispatchVehicle(v), bs as Parameters<typeof simulateRoute>[1], {
      ...opts,
      maxCallsPerVehicle: Number.MAX_SAFE_INTEGER,
    });
    if (!stops && !force && v.id === target) {
      redirect(`/admin/dispatch?date=${run.service_date}&run=${a.run_id}&conflict=${id}&to=${target}`);
    }
    for (const s of stops ?? []) {
      const row = own.find((x) => x.booking_id === s.bookingId)!;
      updates.push({ id: row.id, seq: s.seq, ready_at: new Date(s.readyAt).toISOString(), deadhead_km: s.deadheadKm, deadhead_min: s.deadheadMin });
    }
  }

  await supabase
    .from("dispatch_assignments")
    .update({
      vehicle_id: target,
      driver_id: drivers?.[0]?.id ?? null,
      unassigned_reason: target ? null : "MANUAL",
      seq: null, // 아래 경로 재계산에서 채워진다
    })
    .eq("id", id);
  await Promise.all(
    updates.map((u) => supabase.from("dispatch_assignments").update({ seq: u.seq, ready_at: u.ready_at, deadhead_km: u.deadhead_km, deadhead_min: u.deadhead_min }).eq("id", u.id)),
  );
  await refreshSummary(supabase, a.run_id);
  revalidatePath("/admin/dispatch");
  redirect(`/admin/dispatch?date=${run.service_date}&run=${a.run_id}`);
}

async function refreshSummary(db: Awaited<ReturnType<typeof assertAdmin>>["supabase"], runId: string) {
  const { data: run } = await db.from("dispatch_runs").select("summary").eq("id", runId).single();
  const { data: rows } = await db.from("dispatch_assignments").select("vehicle_id,unassigned_reason,deadhead_km").eq("run_id", runId);
  if (!run || !rows) return;
  const byReason: Record<string, number> = {};
  for (const r of rows) if (!r.vehicle_id) byReason[r.unassigned_reason ?? "MANUAL"] = (byReason[r.unassigned_reason ?? "MANUAL"] ?? 0) + 1;
  const assigned = rows.filter((r) => r.vehicle_id).length;
  await db
    .from("dispatch_runs")
    .update({
      summary: {
        ...run.summary,
        assigned,
        unassigned: rows.length - assigned,
        vehiclesUsed: new Set(rows.filter((r) => r.vehicle_id).map((r) => r.vehicle_id)).size,
        totalDeadheadKm: Math.round(rows.reduce((s, r) => s + (r.vehicle_id ? r.deadhead_km ?? 0 : 0), 0)),
        byReason,
      },
    })
    .eq("id", runId);
}

export async function confirmRun(formData: FormData) {
  const { supabase } = await assertAdmin();
  const runId = String(formData.get("runId"));
  const { data: run } = await supabase.from("dispatch_runs").select("id,service_date").eq("id", runId).single();
  if (!run) throw new Error("배차를 찾을 수 없습니다.");

  // 확정 시점의 차량-기사 연결로 기사 정보를 다시 채운다
  const { data: drivers } = await supabase.from("drivers").select("id,vehicle_id").eq("status", "approved").not("vehicle_id", "is", null);
  const { data: rows } = await supabase.from("dispatch_assignments").select("id,vehicle_id").eq("run_id", runId).not("vehicle_id", "is", null);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id as string, d.id as string]));
  await Promise.all(
    (rows ?? []).map((r) => supabase.from("dispatch_assignments").update({ driver_id: driverOf.get(r.vehicle_id!) ?? null }).eq("id", r.id)),
  );

  await supabase.from("dispatch_runs").update({ status: "draft", confirmed_at: null }).eq("service_date", run.service_date).eq("status", "confirmed");
  const { error } = await supabase.from("dispatch_runs").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dispatch");
  redirect(`/admin/dispatch?date=${run.service_date}&run=${runId}`);
}

export async function unconfirmRun(formData: FormData) {
  const { supabase } = await assertAdmin();
  const runId = String(formData.get("runId"));
  const { data: run } = await supabase.from("dispatch_runs").update({ status: "draft", confirmed_at: null }).eq("id", runId).select("service_date").single();
  revalidatePath("/admin/dispatch");
  redirect(`/admin/dispatch?date=${run?.service_date ?? ""}&run=${runId}`);
}
