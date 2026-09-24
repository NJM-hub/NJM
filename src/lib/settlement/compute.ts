import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "@/lib/format";
import { computeWithholding, type Withholding, type WithholdingOptions } from "@/lib/tax";

export type DriverSettlement = Withholding & {
  driverId: string | null;
  name: string;
  phone: string | null;
  rrnEnc: string | null;
  rrnMasked: string | null;
  bankName: string | null;
  bankAccountEnc: string | null;
  accountHolder: string | null;
  calls: number;
  items: { date: string; pickupAt: string | null; bookingNo: string | null; product: string | null; fare: number; plate: string | null }[];
};

type Row = {
  driver_id: string | null;
  fare: number;
  vehicles: { plate_number: string } | null;
  dispatch_runs: { service_date: string; status: string };
  bookings: { booking_no: string | null; product_name: string | null; pickup_at: string | null };
};

/** 해당 월 확정 배차를 기사별로 합산하고 원천징수액을 계산 */
export async function computeSettlement(db: SupabaseClient, month: string, opts: WithholdingOptions): Promise<DriverSettlement[]> {
  const { from, to } = monthRange(month);
  const { data, error } = await db
    .from("dispatch_assignments")
    .select("driver_id,fare,vehicles(plate_number),dispatch_runs!inner(service_date,status),bookings(booking_no,product_name,pickup_at)")
    .eq("dispatch_runs.status", "confirmed")
    .gte("dispatch_runs.service_date", from)
    .lte("dispatch_runs.service_date", to)
    .not("vehicle_id", "is", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  const ids = [...new Set(rows.map((r) => r.driver_id).filter((x): x is string => !!x))];
  const { data: drivers } = ids.length
    ? await db.from("drivers").select("id,name,phone,rrn_enc,rrn_masked,bank_name,bank_account_enc,account_holder").in("id", ids)
    : { data: [] };
  const info = new Map((drivers ?? []).map((d) => [d.id, d]));

  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.driver_id ?? "", [...(groups.get(r.driver_id ?? "") ?? []), r]);

  return [...groups].map(([driverId, list]) => {
    const d = driverId ? info.get(driverId) : undefined;
    const gross = list.reduce((s, r) => s + (r.fare ?? 0), 0);
    return {
      ...computeWithholding(gross, opts),
      driverId: driverId || null,
      name: d?.name ?? "(기사 미지정 차량)",
      phone: d?.phone ?? null,
      rrnEnc: d?.rrn_enc ?? null,
      rrnMasked: d?.rrn_masked ?? null,
      bankName: d?.bank_name ?? null,
      bankAccountEnc: d?.bank_account_enc ?? null,
      accountHolder: d?.account_holder ?? null,
      calls: list.length,
      items: list
        .map((r) => ({
          date: r.dispatch_runs.service_date,
          pickupAt: r.bookings?.pickup_at ?? null,
          bookingNo: r.bookings?.booking_no ?? null,
          product: r.bookings?.product_name ?? null,
          fare: r.fare,
          plate: r.vehicles?.plate_number ?? null,
        }))
        .sort((a, b) => (a.pickupAt ?? a.date).localeCompare(b.pickupAt ?? b.date)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
