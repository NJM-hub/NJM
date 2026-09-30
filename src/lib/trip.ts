/** 공항 주소로 보이는지 (인천·김포, 한/영/중) */
const AIRPORT = /공항|airport|机场|機場|\bICN\b|\bGMP\b/i;

/**
 * 여정 유형을 "공항 픽업"(공항 → 도심) / "공항 샌딩"(도심 → 공항)으로 맞춘다.
 * 표기가 없으면 주소로 판단: 출발지가 공항이면 픽업, 도착지가 공항이면 샌딩.
 */
export function normalizeTripType(
  s: string | null | undefined,
  pickupAddress?: string | null,
  dropoffAddress?: string | null,
): string | null {
  const t = (s ?? "").trim();
  if (/샌딩|送机|送機|sending|drop[- ]?off/i.test(t)) return "공항 샌딩";
  if (/픽업|接机|接機|pick[- ]?up/i.test(t)) return "공항 픽업";
  if (t) return t;
  const fromAirport = AIRPORT.test(pickupAddress ?? "");
  const toAirport = AIRPORT.test(dropoffAddress ?? "");
  if (toAirport && !fromAirport) return "공항 샌딩";
  if (fromAirport && !toAirport) return "공항 픽업";
  return null;
}
