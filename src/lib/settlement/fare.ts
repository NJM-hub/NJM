/** 콜 금액 규칙: 기본 / 김포공항 / 피켓(공항 미팅) 추가금 / 어린이 좌석 추가금(1개당) */
export type FareRules = { base: number; gimpo: number; picketExtra: number; childSeatExtra?: number };

export type FareInput = {
  /** 예약에 적힌 금액 (있으면 규칙보다 우선) */
  fare?: number | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  pickup_place?: string | null;
  dropoff_place?: string | null;
  memo?: string | null;
};

export function fareFor(b: FareInput, r: FareRules): number {
  if (b.fare != null) return b.fare;
  const places = [b.pickup_address, b.dropoff_address, b.pickup_place, b.dropoff_place].filter(Boolean).join(" ");
  const gimpo = /김포|gimpo|\bGMP\b|金浦/i.test(places);
  // KKday 추가 서비스 "공항에서 픽업 1" 또는 메모의 피켓/举牌
  const picket = /공항에서 픽업\s*[1-9]|피켓|举牌|舉牌|picket/i.test(b.memo ?? "");
  return (gimpo ? r.gimpo : r.base) + (picket ? r.picketExtra : 0) + childSeats(b.memo) * (r.childSeatExtra ?? 0);
}

/** 어린이 좌석 개수: "어린이 좌석 2", "儿童座椅*1" (손님이 직접 가져오는 自備 좌석은 제외) */
export function childSeats(memo: string | null | undefined): number {
  const m = (memo ?? "").match(/(?:어린이 좌석|儿童座椅|兒童座椅|child seat)\s*[*x×:]?\s*(\d+)/i);
  return m ? Math.min(Number(m[1]), 9) : 0;
}
