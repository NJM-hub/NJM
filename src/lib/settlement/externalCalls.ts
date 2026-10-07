import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { withoutVat } from "@/lib/kkday/statement";
import { monthRange } from "@/lib/format";
import { ko } from "@/lib/ko";
import { loadSettings } from "@/lib/settings";
import { normalizeTripType } from "@/lib/trip";
import { OWN_CALL, ownCallAmount } from "./vehicleMonthly";

/** 외부(타업체)로 준 콜: 시트 기사 칸에 금액만 적힌 건 */
export type OutCall = {
  id: string;
  date: string;
  pickupAt: string | null;
  bookingNo: string | null;
  tripType: string | null;
  vehicleClass: string | null;
  pax: number | null;
  from: string | null;
  to: string | null;
  flightNo: string | null;
  /** 외부 업체에 준 금액 (시트 숫자) */
  fare: number;
  /** KKday 정산내역서 최종 금액 (부가세 포함, 내역서를 올리지 않았으면 null) */
  kkdayAmount: number | null;
  /** 부가세 뺀 금액 */
  kkdayNet: number | null;
  /** 차액 = 부가세 뺀 금액 − 외부에 준 금액 */
  diff: number | null;
};

/** 외부에서 받은 콜: 기사가 직접 받아온 자체 콜 (시트 표 아래 기사별 칸) */
export type InCall = {
  id: string;
  date: string;
  pickupAt: string | null;
  vehicleId: string | null;
  plate: string | null;
  driverName: string | null;
  tripType: string | null;
  content: string;
  /** 전세 등 시트에 적힌 요금 */
  charterFare: number | null;
  /** 정산 금액 (시트 금액이 있으면 −그 금액, 없으면 −차감액, 정산 화면에서 고친 값이 있으면 그 값) */
  settleAmount: number;
  paid: boolean;
};

type Row = {
  id: string;
  vehicle_id: string | null;
  unassigned_reason: string | null;
  fare: number;
  settle_amount: number | null;
  vehicles: { plate_number: string; driver_name: string | null } | null;
  drivers: { name: string } | null;
  dispatch_runs: { service_date: string };
  bookings: {
    booking_no: string | null; pickup_at: string | null; trip_type: string | null; vehicle_class: string | null;
    pax: number | null; pickup_address: string | null; dropoff_address: string | null; pickup_place: string | null;
    dropoff_place: string | null; flight_no: string | null; memo: string | null; source: string | null; fare: number | null;
    raw: Record<string, string> | null;
  } | null;
};

const byTime = <T extends { date: string; pickupAt: string | null }>(a: T, b: T) =>
  (a.pickupAt ?? `${a.date}T99`).localeCompare(b.pickupAt ?? `${b.date}T99`);

/** 그 달 확정 배차 기준 외부로 준 콜 / 외부에서 받은 콜 */
export async function loadExternalCalls(db: SupabaseClient, month: string) {
  const { from, to } = monthRange(month);
  const settings = await loadSettings(db);
  const ownCallFee = settings.own_call_fee ?? 15000;
  const data = await fetchAll((a, b) => db
    .from("dispatch_assignments")
    .select(
      "id,vehicle_id,unassigned_reason,fare,settle_amount,vehicles(plate_number,driver_name),drivers(name),dispatch_runs!inner(service_date,status)," +
        "bookings(booking_no,pickup_at,trip_type,vehicle_class,pax,pickup_address,dropoff_address,pickup_place,dropoff_place,flight_no,memo,source,fare,raw)",
    )
    .eq("dispatch_runs.status", "confirmed")
    .gte("dispatch_runs.service_date", from)
    .lte("dispatch_runs.service_date", to)
    .order("id")
    .range(a, b));
  const rows = data as unknown as Row[];

  const out: OutCall[] = rows
    .filter((r) => !r.vehicle_id && r.unassigned_reason === "EXTERNAL")
    .map((r) => {
      const b = r.bookings;
      return {
        id: r.id,
        date: r.dispatch_runs.service_date,
        pickupAt: b?.pickup_at ?? null,
        bookingNo: b?.booking_no ?? null,
        tripType: normalizeTripType(b?.trip_type, b?.pickup_address, b?.dropoff_address),
        vehicleClass: b?.vehicle_class ?? null,
        pax: b?.pax ?? null,
        from: b?.pickup_place ?? b?.pickup_address ?? null,
        to: b?.dropoff_place ?? b?.dropoff_address ?? null,
        flightNo: b?.flight_no ?? null,
        fare: r.fare ?? 0,
        kkdayAmount: null,
        kkdayNet: null,
        diff: null,
      } as OutCall;
    })
    .sort(byTime);

  // KKday 정산내역서 금액 붙이기
  const nos = [...new Set(out.map((c) => c.bookingNo).filter((n): n is string => !!n))];
  const amountOf = new Map<string, number>();
  for (let i = 0; i < nos.length; i += 200) {
    const { data: st, error: sErr } = await db.from("kkday_statements").select("booking_no,amount").in("booking_no", nos.slice(i, i + 200));
    if (sErr) throw new Error(sErr.message);
    for (const s of st ?? []) amountOf.set(s.booking_no as string, s.amount as number);
  }
  for (const c of out) {
    const a = c.bookingNo ? amountOf.get(c.bookingNo) : undefined;
    if (a == null) continue;
    c.kkdayAmount = a;
    c.kkdayNet = withoutVat(a);
    c.diff = c.kkdayNet - c.fare;
  }

  const inCalls: InCall[] = rows
    .filter((r) => r.bookings?.source === OWN_CALL)
    .map((r) => {
      const b = r.bookings!;
      return {
        id: r.id,
        date: r.dispatch_runs.service_date,
        pickupAt: b.pickup_at,
        vehicleId: r.vehicle_id,
        plate: r.vehicles?.plate_number ?? null,
        driverName: ko(r.drivers?.name ?? r.vehicles?.driver_name ?? b.raw?.["기사"] ?? null),
        tripType: b.trip_type,
        content: b.raw?.["내용"] ?? b.memo ?? "",
        charterFare: b.fare,
        settleAmount: r.settle_amount ?? ownCallAmount(b.fare, ownCallFee),
        paid: b.raw?.["입금"] === "확인",
      };
    })
    // 날짜(·시간)순, 같은 시각이면 차량순
    .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b) || (a.plate ?? "").localeCompare(b.plate ?? ""));

  return { month, ownCallFee, out, inCalls };
}
