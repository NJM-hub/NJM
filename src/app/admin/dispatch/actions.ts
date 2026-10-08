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
import { gradeRequired, parseVehicleClass } from "@/lib/dispatch/vehicleClass";
import { isDate } from "@/lib/format";
import { areaLocation } from "@/lib/areas";
import { geocodeAddresses } from "@/lib/geocode";
import { dispatchOptionsOf, fareRulesOf, loadSettings } from "@/lib/settings";
import { fareFor } from "@/lib/settlement/fare";
import { OWN_CALL_SOURCE, type SheetBooking } from "@/lib/kkday/sheet";
import { planSheetVehicles, sheetVehicleKey } from "@/lib/dispatch/sheetPlan";
import { saveBookings } from "../upload/actions";

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
  vehicle_class: string | null;
  wait_min: number | null;
  pickup_place: string | null;
  dropoff_place: string | null;
  pickup_geo: string | null;
  dropoff_geo: string | null;
  fixed_vehicle_id?: string | null;
  memo?: string | null;
};

type VehicleRow = {
  id: string;
  seats: number;
  grade: string | null;
  base_address: string | null;
  base_lat: number | null;
  base_lng: number | null;
};

const pt = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null);

function toDispatchBooking(b: BookingRow): DispatchBooking {
  const cls = parseVehicleClass(b.vehicle_class);
  return {
    minSeats: cls.seats,
    grade: gradeRequired(cls.grade),
    waitMin: b.wait_min,
    fixedVehicleId: b.fixed_vehicle_id ?? null,
    id: b.id,
    pickupAt: b.pickup_at ? new Date(b.pickup_at).getTime() : null,
    durationMin: b.duration_min,
    pickup: pt(b.pickup_lat, b.pickup_lng),
    dropoff: pt(b.dropoff_lat, b.dropoff_lng),
    pax: b.pax,
  };
}

function toDispatchVehicle(v: VehicleRow): DispatchVehicle {
  return { id: v.id, seats: v.seats, grade: v.grade, base: pt(v.base_lat, v.base_lng) };
}

/**
 * 좌표가 없거나 대략 위치(구 중심)인 예약의 주소를 지도 검색으로 정확한 좌표로 바꾼다.
 * 시간 안에 못 찾은 곳은 구·동네 중심 좌표로 추정해서라도 거리를 계산한다.
 */
async function fillCoordinates(
  db: Awaited<ReturnType<typeof assertAdmin>>["supabase"],
  bookings: BookingRow[],
  vehicles: VehicleRow[],
) {
  const need = (lat: number | null, geo: string | null) => lat == null || geo === "area";
  const addrs: string[] = [];
  for (const b of bookings) {
    if (need(b.pickup_lat, b.pickup_geo)) addrs.push(...[b.pickup_address, b.pickup_place].filter((x): x is string => !!x));
    if (need(b.dropoff_lat, b.dropoff_geo)) addrs.push(...[b.dropoff_address, b.dropoff_place].filter((x): x is string => !!x));
  }
  for (const v of vehicles) if (v.base_lat == null && v.base_address) addrs.push(v.base_address);
  if (!addrs.length) return;
  const geo = await geocodeAddresses(db, addrs);
  const lookup = (a: string | null) => (a ? geo.get(a.trim()) ?? null : null);

  type Fix = { lat: number; lng: number; geo: "exact" | "area" };
  const locate = (addr: string | null, place: string | null): Fix | null => {
    // 상세 주소로 못 찾으면 장소명(호텔명), 그래도 없으면 구·동네 중심
    const exact = lookup(addr) ?? lookup(place);
    if (exact) return { ...exact, geo: "exact" };
    const area = areaLocation(addr, place);
    return area ? { ...area, geo: "area" } : null;
  };

  const updates: PromiseLike<unknown>[] = [];
  for (const b of bookings) {
    const p = need(b.pickup_lat, b.pickup_geo) ? locate(b.pickup_address, b.pickup_place) : null;
    const d = need(b.dropoff_lat, b.dropoff_geo) ? locate(b.dropoff_address, b.dropoff_place) : null;
    const changed = (f: Fix | null, geoNow: string | null) => f && !(f.geo === "area" && geoNow === "area");
    if (!changed(p, b.pickup_geo) && !changed(d, b.dropoff_geo)) continue;
    if (p) [b.pickup_lat, b.pickup_lng, b.pickup_geo] = [p.lat, p.lng, p.geo];
    if (d) [b.dropoff_lat, b.dropoff_lng, b.dropoff_geo] = [d.lat, d.lng, d.geo];
    updates.push(
      db.from("bookings").update({
        pickup_lat: b.pickup_lat, pickup_lng: b.pickup_lng, pickup_geo: b.pickup_geo,
        dropoff_lat: b.dropoff_lat, dropoff_lng: b.dropoff_lng, dropoff_geo: b.dropoff_geo,
      }).eq("id", b.id),
    );
  }
  for (const v of vehicles) {
    const p = v.base_lat == null ? lookup(v.base_address) ?? areaLocation(v.base_address) : null;
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
  // 실행할 때 고르는 옵션: 차량당 최대 콜 수, 차급(컴포트·인승) 엄격 적용 여부
  const maxCalls = Number(formData.get("maxCalls"));
  if (Number.isInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 20) opts.maxCallsPerVehicle = maxCalls;
  const strictClass = formData.get("strictClass") === "on";

  const [{ data: bookings, error: bErr }, { data: vehicles, error: vErr }, { data: drivers }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,pickup_at,duration_min,pickup_address,pickup_lat,pickup_lng,dropoff_address,dropoff_lat,dropoff_lng,pax,fare,vehicle_class,wait_min,pickup_place,dropoff_place,pickup_geo,dropoff_geo,fixed_vehicle_id,source,memo")
      .eq("service_date", date),
    supabase.from("vehicles").select("id,seats,grade,base_address,base_lat,base_lng").eq("active", true).order("plate_number"),
    supabase.from("drivers").select("id,vehicle_id").eq("status", "approved").not("vehicle_id", "is", null),
  ]);
  if (bErr || vErr) throw new Error(bErr?.message ?? vErr?.message);
  if (!bookings?.length) throw new Error("해당 날짜에 예약이 없습니다. 먼저 일정표를 업로드하세요.");

  // 체크된 차량만 사용 (체크 정보가 없으면 전체 운행 가능 차량). 기사 자체 콜이 있는 차량은 항상 포함
  const fixedIds = new Set(bookings.map((b) => b.fixed_vehicle_id).filter((v): v is string => !!v));
  const usable = (vehicles ?? []).filter((v) => vehicleIds.length === 0 || vehicleIds.includes(v.id) || fixedIds.has(v.id));
  if (!usable.length) throw new Error("사용할 차량이 없습니다.");

  await fillCoordinates(supabase, bookings, usable);

  // 실제 운영처럼 차급은 보지 않고 인원만 맞추기 (스타리아 9인승이 컴포트·10인승 예약도 운행)
  const toBooking = (b: BookingRow) => {
    const d = toDispatchBooking(b);
    return strictClass ? d : { ...d, minSeats: null, grade: null };
  };
  const result = dispatch(bookings.map(toBooking), usable.map(toDispatchVehicle), opts);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id as string, d.id as string]));
  const rules = fareRulesOf(settings);
  const fareOf = new Map(bookings.map((b) => [b.id, b.source === OWN_CALL_SOURCE ? b.fare ?? 0 : fareFor(b, rules)]));
  // 시간이 없는 자체 콜(전세 등)은 동선 계산 없이 그 차량에 붙인다
  const usableIds = new Set(usable.map((v) => v.id));
  const fixedUntimed = new Map(
    bookings.filter((b) => b.fixed_vehicle_id && usableIds.has(b.fixed_vehicle_id) && !b.pickup_at).map((b) => [b.id, b.fixed_vehicle_id!]),
  );

  // 같은 날짜의 이전 초안은 정리
  await supabase.from("dispatch_runs").delete().eq("service_date", date).eq("status", "draft");

  const { data: run, error: rErr } = await supabase
    .from("dispatch_runs")
    .insert({
      service_date: date,
      options: { ...opts, vehicleIds: usable.map((v) => v.id), strictClass },
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
    ...result.unassigned.map((u) => {
      const vid = fixedUntimed.get(u.bookingId) ?? null;
      return {
        run_id: run.id,
        booking_id: u.bookingId,
        vehicle_id: vid,
        driver_id: vid ? driverOf.get(vid) ?? null : null,
        unassigned_reason: vid ? null : u.reason,
        fare: fareOf.get(u.bookingId) ?? 0,
      };
    }),
  ];
  const { error: aErr } = await supabase.from("dispatch_assignments").insert(rows);
  if (aErr) throw new Error(aErr.message);
  if (fixedUntimed.size) await refreshSummary(supabase, run.id);

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
    .select("id,vehicle_id,booking_id,bookings(id,pickup_at,duration_min,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pax,vehicle_class,wait_min)")
    .eq("run_id", a.run_id);
  const { data: vehicles } = affected.length
    ? await supabase.from("vehicles").select("id,seats,grade,base_address,base_lat,base_lng").in("id", affected)
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
  const external = rows.filter((r) => !r.vehicle_id && r.unassigned_reason === "EXTERNAL").length;
  for (const r of rows) {
    if (r.vehicle_id || r.unassigned_reason === "EXTERNAL") continue;
    byReason[r.unassigned_reason ?? "MANUAL"] = (byReason[r.unassigned_reason ?? "MANUAL"] ?? 0) + 1;
  }
  const assigned = rows.filter((r) => r.vehicle_id).length;
  await db
    .from("dispatch_runs")
    .update({
      summary: {
        ...run.summary,
        assigned,
        external,
        unassigned: rows.length - assigned - external,
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

export type SheetImportResult =
  | {
      ok: true; count: number; dates: string[]; assigned: number; external: number; unassigned: number; ownCalls: number;
      /** 차량 목록에 없어 미배정으로 둔 시트 차량(번호 뒤 4자리 또는 기사명) */
      unmatchedVehicles: string[];
    }
  | { ok: false; error: string };

/**
 * 구글 시트 배차표를 그대로 전산에 반영한다.
 * 예약을 저장하고, 시트의 기사/차량(차량번호 뒤 4자리)을 차량 목록과 맞춰 (차량 목록은 고치지 않는다. 없는 차량의 건은 미배정)
 * 날짜별로 시트와 똑같은 배차를 만들어 확정한다. 금액만 적힌 건은 외부 배차로 기록한다.
 * 표 아래 기사별 칸의 자체 콜은 출처(driver_own)를 달아 그 기사 차량에 고정한다.
 */
export async function importSheetDispatch(
  filename: string,
  rows: SheetBooking[],
  cancelledNos: string[] = [],
): Promise<SheetImportResult> {
  const saved = await saveBookings(filename, rows);
  if (!saved.ok) return saved;
  const { supabase, user } = await assertAdmin();
  // 시트에서 취소 표시된 예약은 전산에서도 지운다 (배차 내역은 함께 삭제됨)
  if (cancelledNos.length) {
    const { error } = await supabase.from("bookings").delete().in("booking_no", cancelledNos).in("service_date", saved.dates);
    if (error) return { ok: false, error: error.message };
  }
  const settings = await loadSettings(supabase);
  const opts: DispatchOptions = dispatchOptionsOf(settings);
  const valid = rows.filter((r) => r.serviceDate);

  // 1. 차량 맞추기 (차량 목록은 새로 만들거나 고치지 않는다)
  const { data: vehicles, error: vErr } = await supabase.from("vehicles").select("id,plate_number,driver_name");
  if (vErr) return { ok: false, error: vErr.message };
  const plan = planSheetVehicles(valid, vehicles ?? []);
  const vehicleOf = new Map(plan.matched);
  const unmatchedVehicles = plan.create.map((c) => c.key);

  // 기사 자체 콜: 차량 고정, 시트에서 지워진 자체 콜은 삭제
  const ownSheet = valid.filter((r) => r.source === OWN_CALL_SOURCE && r.bookingNo);
  const ownByVehicle = new Map<string, string[]>();
  for (const r of ownSheet) {
    const vid = vehicleOf.get(sheetVehicleKey(r) ?? "");
    if (vid) ownByVehicle.set(vid, [...(ownByVehicle.get(vid) ?? []), r.bookingNo!]);
  }
  for (const [vid, nos] of ownByVehicle) {
    const { error } = await supabase.from("bookings").update({ fixed_vehicle_id: vid }).in("booking_no", nos).in("service_date", saved.dates);
    if (error) return { ok: false, error: error.message };
  }
  for (const date of saved.dates) {
    const keep = ownSheet.filter((r) => r.serviceDate === date).map((r) => r.bookingNo!);
    let q = supabase.from("bookings").delete().eq("service_date", date).eq("source", OWN_CALL_SOURCE);
    if (keep.length) q = q.not("booking_no", "in", `(${keep.map((n) => `"${n}"`).join(",")})`);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
  }

  const { data: drivers } = await supabase.from("drivers").select("id,vehicle_id").eq("status", "approved").not("vehicle_id", "is", null);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id as string, d.id as string]));

  // 2. 날짜별 배차 만들기
  const totals = { assigned: 0, external: 0, unassigned: 0, ownCalls: 0 };
  for (const date of saved.dates) {
    const sheetRows = valid.filter((r) => r.serviceDate === date);
    const sheetByNo = new Map(sheetRows.filter((r) => r.bookingNo).map((r) => [r.bookingNo!, r]));
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id,booking_no,pickup_at,duration_min,pickup_address,pickup_lat,pickup_lng,dropoff_address,dropoff_lat,dropoff_lng,pax,fare,vehicle_class,wait_min,pickup_place,dropoff_place,pickup_geo,dropoff_geo,source,memo")
      .eq("service_date", date);
    if (bErr || !bookings) return { ok: false, error: bErr?.message ?? "예약을 불러오지 못했습니다." };

    const vehicleIdOf = (b: { booking_no: string | null }) => {
      const r = b.booking_no ? sheetByNo.get(b.booking_no) : undefined;
      const k = r ? sheetVehicleKey(r) : null;
      return k ? vehicleOf.get(k) ?? null : null;
    };
    const usedIds = [...new Set(bookings.map(vehicleIdOf).filter((v): v is string => !!v))];
    const { data: used } = usedIds.length
      ? await supabase.from("vehicles").select("id,seats,grade,base_address,base_lat,base_lng").in("id", usedIds)
      : { data: [] as VehicleRow[] };
    await fillCoordinates(supabase, bookings, used ?? []);

    type Row = {
      run_id?: string; booking_id: string; vehicle_id: string | null; driver_id: string | null; seq: number | null;
      ready_at: string | null; deadhead_km: number | null; deadhead_min: number | null; unassigned_reason: string | null; fare: number;
    };
    const rowsOut: Row[] = [];
    for (const v of used ?? []) {
      const own = bookings.filter((b) => vehicleIdOf(b) === v.id).sort((p, q) => (p.pickup_at ?? "").localeCompare(q.pickup_at ?? ""));
      const timed = own.map(toDispatchBooking).filter((b) => b.pickupAt != null) as Parameters<typeof simulateRoute>[1];
      // 시트대로 배정하므로 콜 수 제한 없이 동선만 계산 (시간상 무리한 동선이면 순번만 매긴다)
      const stops = simulateRoute(toDispatchVehicle(v), timed, { ...opts, maxCallsPerVehicle: Number.MAX_SAFE_INTEGER });
      const timedIds = timed.map((b) => b.id);
      for (const b of own) {
        const s = stops?.find((x) => x.bookingId === b.id);
        const idx = timedIds.indexOf(b.id);
        rowsOut.push({
          booking_id: b.id, vehicle_id: v.id, driver_id: driverOf.get(v.id) ?? null, seq: s?.seq ?? (idx >= 0 ? idx + 1 : null),
          ready_at: s ? new Date(s.readyAt).toISOString() : null, deadhead_km: s?.deadheadKm ?? null, deadhead_min: s?.deadheadMin ?? null,
          unassigned_reason: null, fare: b.source === OWN_CALL_SOURCE ? b.fare ?? 0 : fareFor(b, fareRulesOf(settings)),
        });
      }
    }
    for (const b of bookings) {
      if (vehicleIdOf(b)) continue;
      const d = b.booking_no ? sheetByNo.get(b.booking_no)?.sheetDriver : undefined;
      const reason = d === undefined ? "NOT_IN_SHEET" : d?.kind === "external" ? "EXTERNAL" : d?.kind === "vehicle" ? "SHEET_NO_VEHICLE" : "SHEET_EMPTY";
      rowsOut.push({
        booking_id: b.id, vehicle_id: null, driver_id: null, seq: null, ready_at: null, deadhead_km: null, deadhead_min: null,
        unassigned_reason: reason, fare: d?.kind === "external" ? d.fare : fareFor(b, fareRulesOf(settings)),
      });
    }

    const assigned = rowsOut.filter((r) => r.vehicle_id).length;
    const external = rowsOut.filter((r) => r.unassigned_reason === "EXTERNAL").length;
    const ownCalls = bookings.filter((b) => b.source === OWN_CALL_SOURCE).length;
    const byReason: Record<string, number> = {};
    for (const r of rowsOut) if (r.unassigned_reason && r.unassigned_reason !== "EXTERNAL") byReason[r.unassigned_reason] = (byReason[r.unassigned_reason] ?? 0) + 1;
    const summary = {
      totalBookings: rowsOut.length,
      assigned,
      external,
      ownCalls,
      unassigned: rowsOut.length - assigned - external,
      vehiclesUsed: usedIds.length,
      totalDeadheadKm: Math.round(rowsOut.reduce((s, r) => s + (r.deadhead_km ?? 0), 0)),
      byReason,
      extraVehiclesNeeded: 0,
    };
    totals.assigned += assigned;
    totals.external += external;
    totals.unassigned += summary.unassigned;
    totals.ownCalls += ownCalls;

    // 시트가 최종 배차이므로 확정본으로 만든다 (기존 확정본은 초안으로 남기고, 이전 초안은 정리)
    await supabase.from("dispatch_runs").delete().eq("service_date", date).eq("status", "draft");
    await supabase.from("dispatch_runs").update({ status: "draft", confirmed_at: null }).eq("service_date", date).eq("status", "confirmed");
    const { data: run, error: rErr } = await supabase
      .from("dispatch_runs")
      .insert({
        service_date: date,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        options: { ...opts, vehicleIds: usedIds, source: "sheet", filename },
        summary,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (rErr || !run) return { ok: false, error: rErr?.message ?? "배차 저장 실패" };
    const { error: aErr } = await supabase.from("dispatch_assignments").insert(rowsOut.map((r) => ({ ...r, run_id: run.id })));
    if (aErr) return { ok: false, error: aErr.message };
  }

  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/vehicles");
  return { ok: true, count: saved.count, dates: saved.dates, ...totals, unmatchedVehicles };
}
