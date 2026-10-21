// ─────────────────────────────────────────────────────────────
// 차량과 요금 — 차량 추가·가격 변경은 여기서 합니다.
// specs 에는 확인된 사양만 넣어 주세요. 비워 두면 비교표에 '상담 문의'로 나옵니다.
// 사진: public/images 에 실제 차량 사진(jpg/png/webp)을 넣고 image 경로를 바꾸세요.
// ─────────────────────────────────────────────────────────────

export type Vehicle = {
  id: string;
  name: string;
  shortName: string;
  dailyPrice: number; // 원
  headline: string; // 크게 보이는 가격 문구
  ctaLabel: string; // 차량 카드 문의 버튼 글자
  uses: string[]; // 추천 용도
  image: string;
  imageAlt: string;
  /** 비교표 항목 (확인된 값만). 키는 compareRows 의 key 와 같아야 합니다. */
  specs: Partial<Record<CompareKey, string>>;
};

export const compareRows = [
  { key: "seats", label: "탑승 인원" },
  { key: "fuel", label: "연료" },
  { key: "luggage", label: "적재 공간" },
  { key: "license", label: "필요 면허" },
] as const;

export type CompareKey = (typeof compareRows)[number]["key"];

export const vehicles: Vehicle[] = [
  {
    id: "staria",
    name: "현대 스타리아 하이브리드",
    shortName: "스타리아 하이브리드",
    dailyPrice: 80_000,
    headline: "하루 8만원",
    ctaLabel: "스타리아 렌트 문의",
    uses: ["가족 여행", "출장", "공항 이동", "일상적인 단체 이동"],
    image: "/images/staria.svg",
    imageAlt: "현대 스타리아 하이브리드 승합차",
    specs: {
      fuel: "하이브리드",
    },
  },
  {
    id: "solati",
    name: "현대 쏠라티",
    shortName: "쏠라티",
    dailyPrice: 200_000,
    headline: "하루 20만원",
    ctaLabel: "쏠라티 렌트 문의",
    uses: ["단체 여행", "행사 이동", "가족 모임", "넓은 실내 공간이 필요한 이동"],
    image: "/images/solati.svg",
    imageAlt: "현대 쏠라티 대형 승합차",
    specs: {},
  },
];

export function findVehicle(id: string): Vehicle | undefined {
  return vehicles.find((v) => v.id === id);
}

export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
