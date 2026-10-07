import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OPTIONS, type DispatchOptions } from "@/lib/dispatch/algorithm";
import type { FareRules } from "@/lib/settlement/fare";
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
  /** 외부오더(기사 자체 콜) 1건당 차감액 */
  own_call_fee: number;
  /** 김포공항 콜 금액 */
  fare_gimpo: number;
  /** 피켓(공항 미팅) 추가금 */
  fare_picket_extra: number;
  /** 어린이 좌석 추가금 (1개당) */
  fare_child_seat_extra: number;
  /** 같은 사람인데 이름이 다른 기사 ("다른 이름 = 정산에 쓸 이름" 줄 목록) */
  driver_aliases: string | null;
};

export function fareRulesOf(s: AppSettings): FareRules {
  return { base: s.fare_per_call, gimpo: s.fare_gimpo ?? s.fare_per_call, picketExtra: s.fare_picket_extra ?? 0, childSeatExtra: s.fare_child_seat_extra ?? 5000 };
}

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
