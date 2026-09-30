import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "@/lib/format";
import { fareRulesOf, loadSettings, withholdingOf } from "@/lib/settings";
import { normalizeTripType } from "@/lib/trip";
import { fareFor } from "./fare";
import {
  OWN_CALL, computePayout, summarizeVehicleMonth, tripKind,
  type Expenses, type Payout, type VehicleMonth, type VehicleMonthRow,
} from "./vehicleMonthly";

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
    booking_no: string | null; flight_no: string | null; trip_type: string | null; source: string | null;
    pickup_at: string | null; vehicle_class: string | null; pax: number | null; memo: string | null;
    fare: number | null; pickup_address: string | null; dropoff_address: string | null;
    pickup_place: string | null; dropoff_place: string | null;
  } | null;
};

/** 정산에 직접 추가한 항목 (TALIXO 등) */
type ItemRow = {
  id: string; vehicle_id: string; work_date: string; work_time: string | null; source: string; ref_no: string | null;
  trip_type: string | null; flight_no: string | null; vehicle_class: string | null; pax: number | null; memo: string | null; amount: number;
};

export type ExternalDay = { date: string; pickup: number; sending: number; other: number; fare: number };

export type SettlementStatus = { status: "draft" | "confirmed"; confirmedAt: string | null };

export type VehicleMonthReport = {
  month: string;
  companyName: string | null;
  ownCallFee: number;
  vehicles: (VehicleMonth & { expenses: Expenses | null; payout: Payout } & SettlementStatus)[];
  /** 외부(타업체)로 넘긴 콜, 날짜별 */
  external: ExternalDay[];
  /** 배차가 초안만 있고 확정되지 않은 날짜 (정산에서 빠짐) */
  draftOnlyDates: string[];
};

export const MANUAL_PREFIX = "m_";

export async function loadVehicleMonth(db: SupabaseClient, month: string): Promise<VehicleMonthReport> {
  const { from, to } = monthRange(month);
  const settings = await loadSettings(db);
  const ownCallFee = settings.own_call_fee ?? 15000;
  const rules = fareRulesOf(settings);
  const [{ data, error }, { data: runs }, { data: expenses }, { data: items }] = await Promise.all([
    db
      .from("dispatch_assignments")
      .select(
        "id,vehicle_id,unassigned_reason,fare,settle_amount,vehicles(plate_number,driver_name),drivers(name),dispatch_runs!inner(service_date,status)," +
          "bookings(booking_no,flight_no,trip_type,source,pickup_at,vehicle_class,pax,memo,fare,pickup_address,dropoff_address,pickup_place,dropoff_place)",
      )
      .eq("dispatch_runs.status", "confirmed")
      .gte("dispatch_runs.service_date", from)
      .lte("dispatch_runs.service_date", to),
    db.from("dispatch_runs").select("service_date,status").gte("service_date", from).lte("service_date", to),
    db.from("vehicle_month_expenses").select("vehicle_id,fuel,fines,tolls,engine_oil,other,memo,status,confirmed_at").eq("month", month),
    db.from("vehicle_month_items").select("*").eq("month", month),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const manual = (items ?? []) as ItemRow[];

  const vehicleRows: VehicleMonthRow[] = rows
    .filter((r) => r.vehicle_id)
    .map((r) => {
      const own = r.bookings?.source === OWN_CALL;
      // 기본 금액: 외부오더는 −차감액, 그 외는 콜 금액 규칙(기본·김포·피켓). 손으로 고친 값이 있으면 그 값
      const base = own ? -ownCallFee : r.bookings ? fareFor(r.bookings, rules) : r.fare ?? 0;
      return {
        id: r.id,
        serviceDate: r.dispatch_runs.service_date,
        vehicleId: r.vehicle_id!,
        plate: r.vehicles?.plate_number ?? "(삭제된 차량)",
        driverName: r.drivers?.name ?? r.vehicles?.driver_name ?? null,
        // 구분이 비어 있으면 주소로 판단 (출발지 공항 = 픽업, 도착지 공항 = 샌딩)
        tripType: normalizeTripType(r.bookings?.trip_type, r.bookings?.pickup_address, r.bookings?.dropoff_address),
        source: r.bookings?.source ?? null,
        amount: r.settle_amount ?? base,
        edited: r.settle_amount != null,
        bookingNo: r.bookings?.booking_no ?? null,
        flightNo: r.bookings?.flight_no ?? null,
        pickupAt: r.bookings?.pickup_at ?? null,
        vehicleClass: r.bookings?.vehicle_class ?? null,
        pax: r.bookings?.pax ?? null,
        memo: r.bookings?.memo ?? null,
      };
    });

  // 직접 추가한 항목: 그 차량의 번호·기사 이름이 필요하다
  if (manual.length) {
    const ids = [...new Set(manual.map((m) => m.vehicle_id))];
    const [{ data: vs }, { data: ds }] = await Promise.all([
      db.from("vehicles").select("id,plate_number,driver_name").in("id", ids),
      db.from("drivers").select("name,vehicle_id").in("vehicle_id", ids),
    ]);
    const plateOf = new Map((vs ?? []).map((v) => [v.id as string, v]));
    const driverOf = new Map((ds ?? []).map((d) => [d.vehicle_id as string, d.name as string]));
    for (const m of manual) {
      const v = plateOf.get(m.vehicle_id);
      vehicleRows.push({
        id: `${MANUAL_PREFIX}${m.id}`,
        serviceDate: m.work_date,
        vehicleId: m.vehicle_id,
        plate: v?.plate_number ?? "(삭제된 차량)",
        driverName: driverOf.get(m.vehicle_id) ?? v?.driver_name ?? null,
        tripType: m.trip_type,
        source: null,
        manualSource: m.source,
        amount: m.amount,
        bookingNo: m.ref_no ?? m.source,
        flightNo: m.flight_no,
        pickupAt: m.work_time && /^\d{1,2}:\d{2}$/.test(m.work_time) ? `${m.work_date}T${m.work_time.padStart(5, "0")}:00+09:00` : null,
        vehicleClass: m.vehicle_class,
        pax: m.pax,
        memo: m.memo,
      });
    }
  }

  const ext = new Map<string, ExternalDay>();
  for (const r of rows) {
    if (r.vehicle_id || r.unassigned_reason !== "EXTERNAL") continue;
    const date = r.dispatch_runs.service_date;
    const d = ext.get(date) ?? { date, pickup: 0, sending: 0, other: 0, fare: 0 };
    ext.set(date, d);
    d[tripKind(normalizeTripType(r.bookings?.trip_type, r.bookings?.pickup_address, r.bookings?.dropoff_address))]++;
    d.fare += r.fare ?? 0;
  }

  const confirmed = new Set((runs ?? []).filter((r) => r.status === "confirmed").map((r) => r.service_date as string));
  const draftOnlyDates = [...new Set((runs ?? []).map((r) => r.service_date as string))].filter((d) => !confirmed.has(d)).sort();
  type ExpenseRow = Expenses & { vehicle_id: string; status: string | null; confirmed_at: string | null };
  const expenseOf = new Map(((expenses ?? []) as ExpenseRow[]).map((e) => [e.vehicle_id, e]));
  const tax = withholdingOf(settings);

  return {
    month,
    companyName: settings.company_name,
    ownCallFee,
    vehicles: summarizeVehicleMonth(vehicleRows).map((v) => {
      const e = expenseOf.get(v.vehicleId) ?? null;
      const ex: Expenses | null = e ? { fuel: e.fuel, fines: e.fines, tolls: e.tolls, engine_oil: e.engine_oil, other: e.other, memo: e.memo } : null;
      return {
        ...v,
        expenses: ex,
        payout: computePayout(v.total.amount, ex, tax),
        status: e?.status === "confirmed" ? "confirmed" : "draft",
        confirmedAt: e?.confirmed_at ?? null,
      };
    }),
    external: [...ext.values()].sort((a, b) => a.date.localeCompare(b.date)),
    draftOnlyDates,
  };
}
