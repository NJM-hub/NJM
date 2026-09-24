export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export type TravelOptions = {
  /** 평균 주행 속도 (km/h) */
  avgSpeedKmh: number;
  /** 직선거리 → 실제 도로거리 보정 계수 */
  roadFactor: number;
  /** 좌표를 모를 때 가정하는 이동 시간 (분) */
  unknownTravelMin: number;
};

export type Travel = { km: number | null; min: number };

/** 두 지점 간 예상 이동 거리/시간. 좌표가 없으면 보수적인 기본값을 쓴다. */
export function estimateTravel(
  from: LatLng | null | undefined,
  to: LatLng | null | undefined,
  opts: TravelOptions,
): Travel {
  if (!from || !to) return { km: null, min: opts.unknownTravelMin };
  const km = haversineKm(from, to) * opts.roadFactor;
  return { km, min: (km / opts.avgSpeedKmh) * 60 };
}
