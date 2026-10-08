"use server";
import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/auth";

export async function saveSettings(formData: FormData) {
  const { supabase } = await assertOwner();
  const n = (k: string, min: number, max: number) => {
    const v = Number(formData.get(k));
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${k} 값이 올바르지 않습니다 (${min}~${max}).`);
    return v;
  };
  const row = {
    max_calls_per_vehicle: Math.round(n("max_calls_per_vehicle", 1, 20)),
    buffer_min: Math.round(n("buffer_min", 0, 180)),
    default_duration_min: Math.round(n("default_duration_min", 10, 1440)),
    avg_speed_kmh: Math.round(n("avg_speed_kmh", 5, 120)),
    road_factor: n("road_factor", 1, 3),
    unknown_travel_min: Math.round(n("unknown_travel_min", 0, 300)),
    fare_per_call: Math.round(n("fare_per_call", 0, 10_000_000)),
    own_call_fee: Math.round(n("own_call_fee", 0, 10_000_000)),
    fare_gimpo: Math.round(n("fare_gimpo", 0, 10_000_000)),
    fare_picket_extra: Math.round(n("fare_picket_extra", 0, 10_000_000)),
    fare_child_seat_extra: Math.round(n("fare_child_seat_extra", 0, 10_000_000)),
    income_tax_rate: n("income_tax_rate_pct", 0, 50) / 100,
    local_tax_rate: n("local_tax_rate_pct", 0, 100) / 100,
    business_code: String(formData.get("business_code") ?? "").trim() || "940909",
    company_name: String(formData.get("company_name") ?? "").trim() || null,
    company_brn: String(formData.get("company_brn") ?? "").trim() || null,
    driver_aliases: String(formData.get("driver_aliases") ?? "").trim().slice(0, 5000),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("app_settings").update(row).eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}
