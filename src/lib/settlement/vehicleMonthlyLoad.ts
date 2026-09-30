import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "@/lib/format";
import { loadSettings, withholdingOf } from "@/lib/settings";
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
  } | null;
};

export type ExternalDay = { date: string; pickup: number; sending: number; other: number; fare: number };

export type VehicleMonthReport = {
  month: string;
  companyName: string | null;
  ownCallFee: number;
  vehicles: (VehicleMonth & { expenses: Expenses | null; payout: Payout })[];
  /** 외부(타업체)로 넘긴 콜, 날짜별 */
  external: ExternalDay[];
  /** 배차가 초안만 있고 확정되지 않은 날짜 (정산에서 빠짐) */
  draftOnlyDates: string[];
};

export async function loadVehicleMonth(db: SupabaseClient, month: string): Promise<VehicleMonthReport> {
  const { from, to } = monthRange(month);
  const settings = await loadSettings(db);
  const ownCallFee = settings.own_call_fee ?? 15000;
  const [{ data, error }, { data: runs }, { data: expenses }] = await Promise.all([
    db
      .from("dispatch_assignments")
      .select(
        "id,vehicle_id,unassigned_reason,fare,settle_amount,vehicles(plate_number,driver_name),drivers(name),dispatch_runs!inner(service_date,status)," +
          "bookings(booking_no,flight_no,trip_type,source,pickup_at,vehicle_class,pax,memo)",
      )
      .eq("dispatch_runs.status", "confirmed")
      .gte("dispatch_runs.service_date", from)
      .lte("dispatch_runs.service_date", to),
    db.from("dispatch_runs").select("service_date,status").gte("service_date", from).lte("service_date", to),
    db.from("vehicle_month_expenses").select("vehicle_id,fuel,fines,tolls,engine_oil,other,memo").eq("month", month),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const vehicleRows: VehicleMonthRow[] = rows
    .filter((r) => r.vehicle_id)
    .map((r) => {
      const own = r.bookings?.source === OWN_CALL;
      return {
        id: r.id,
        serviceDate: r.dispatch_runs.service_date,
        vehicleId: r.vehicle_id!,
        plate: r.vehicles?.plate_number ?? "(삭제된 차량)",
        driverName: r.drivers?.name ?? r.vehicles?.driver_name ?? null,
        tripType: r.bookings?.trip_type ?? null,
        source: r.bookings?.source ?? null,
        amount: r.settle_amount ?? (own ? -ownCallFee : r.fare ?? 0),
        edited: r.settle_amount != null,
        bookingNo: r.bookings?.booking_no ?? null,
        flightNo: r.bookings?.flight_no ?? null,
        pickupAt: r.bookings?.pickup_at ?? null,
        vehicleClass: r.bookings?.vehicle_class ?? null,
        pax: r.bookings?.pax ?? null,
        memo: r.bookings?.memo ?? null,
      };
    });

  const ext = new Map<string, ExternalDay>();
  for (const r of rows) {
    if (r.vehicle_id || r.unassigned_reason !== "EXTERNAL") continue;
    const date = r.dispatch_runs.service_date;
    const d = ext.get(date) ?? { date, pickup: 0, sending: 0, other: 0, fare: 0 };
    ext.set(date, d);
    d[tripKind(r.bookings?.trip_type ?? null)]++;
    d.fare += r.fare ?? 0;
  }

  const confirmed = new Set((runs ?? []).filter((r) => r.status === "confirmed").map((r) => r.service_date as string));
  const draftOnlyDates = [...new Set((runs ?? []).map((r) => r.service_date as string))].filter((d) => !confirmed.has(d)).sort();
  const expenseOf = new Map((expenses ?? []).map((e) => [e.vehicle_id as string, e as Expenses]));
  const tax = withholdingOf(settings);

  return {
    month,
    companyName: settings.company_name,
    ownCallFee,
    vehicles: summarizeVehicleMonth(vehicleRows).map((v) => {
      const ex = expenseOf.get(v.vehicleId) ?? null;
      return { ...v, expenses: ex, payout: computePayout(v.total.amount, ex, tax) };
    }),
    external: [...ext.values()].sort((a, b) => a.date.localeCompare(b.date)),
    draftOnlyDates,
  };
}
