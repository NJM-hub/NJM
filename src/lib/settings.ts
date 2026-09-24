import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OPTIONS, type DispatchOptions } from "@/lib/dispatch/algorithm";
import { DEFAULT_WITHHOLDING, type WithholdingOptions } from "@/lib/tax";

export type AppSettings = {
  max_calls_per_vehicle: number;
  buffer_min: number;
  default_duration_min: number;
  avg_speed_kmh: number;
  road_factor: number;
  unknown_travel_min: number;
  fare_per_call: number;
  income_tax_rate: number;
  local_tax_rate: number;
  business_code: string;
  company_name: string | null;
  company_brn: string | null;
};

export async function loadSettings(db: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await db.from("app_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`설정을 불러오지 못했습니다: ${error?.message ?? "데이터 없음"}`);
  return data as AppSettings;
}

export function dispatchOptionsOf(s: AppSettings): DispatchOptions {
  return {
    ...DEFAULT_OPTIONS,
    maxCallsPerVehicle: s.max_calls_per_vehicle,
    bufferMin: s.buffer_min,
    defaultDurationMin: s.default_duration_min,
    avgSpeedKmh: s.avg_speed_kmh,
    roadFactor: s.road_factor,
    unknownTravelMin: s.unknown_travel_min,
  };
}

export function withholdingOf(s: AppSettings): WithholdingOptions {
  return { ...DEFAULT_WITHHOLDING, incomeTaxRate: s.income_tax_rate, localTaxRate: s.local_tax_rate };
}
