import type { LatLng } from "@/lib/dispatch/geo";

/** 공항 터미널 좌표 (차량 승하차 구역 기준, 근사값) */
const TERMINALS: Record<string, Record<string, LatLng>> = {
  ICN: {
    T1: { lat: 37.4492, lng: 126.4506 },
    T2: { lat: 37.4691, lng: 126.4331 },
  },
  GMP: {
    I: { lat: 37.5655, lng: 126.8013 }, // 국제선
    D: { lat: 37.5587, lng: 126.7985 }, // 국내선
  },
};

export function airportLocation(iata: string | null, terminal: string | null): LatLng | null {
  const a = TERMINALS[(iata ?? "").toUpperCase()];
  if (!a) return null;
  const t = (terminal ?? "").toUpperCase().replace(/\s/g, "");
  return a[t] ?? Object.values(a)[0];
}
