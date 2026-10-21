// ─────────────────────────────────────────────────────────────
// 홈페이지 기본 정보 — 이 파일만 고치면 사이트 전체에 반영됩니다.
// 빈 문자열("")로 둔 항목은 화면에 나오지 않거나 '상담 문의'로 표시됩니다.
// 실제 정보만 넣어 주세요.
// ─────────────────────────────────────────────────────────────

export type PriceBasis = "self-drive" | "with-driver";

export const site = {
  brand: "Golden Car",
  brandKo: "골든카",
  tagline: "GOLDEN CAR · VAN RENTAL",

  // 배포한 주소 (검색엔진·공유 미리보기에 사용). 예: "https://goldencar.co.kr"
  url: "https://goldencar.co.kr",

  // ★ 꼭 정해 주세요: 표시된 1일 요금이 어떤 기준인지
  //   "self-drive"  = 차량만 대여 (기사 미포함, 고객이 직접 운전)
  //   "with-driver" = 기사 포함
  //   null          = 아직 미정 → 가격 옆에 '기사 포함 여부 상담 문의'로 표시
  priceBasis: null as PriceBasis | null,

  contact: {
    // 전화번호. 예: "010-1234-5678" (비워 두면 전화 버튼이 예약 문의 양식으로 연결됩니다)
    phone: "1566-2099",
    // 카카오톡 채널 채팅 링크. 예: "https://pf.kakao.com/_xxxxxx/chat"
    kakaoUrl: "",
    email: "",
    // 상담 가능 시간. 예: "매일 09:00 ~ 21:00"
    hours: "",
  },

  // 사업자 정보 (하단에 표시). 실제 정보만 입력하세요.
  business: {
    name: "", // 상호명
    ceo: "", // 대표자명
    registrationNumber: "", // 사업자등록번호
    address: "", // 사업장 주소
  },

  about:
    "Golden Car는 다양한 승합차 렌트 상품을 합리적인 가격과 편리한 예약 과정으로 제공하는 승합차 전문 렌트 브랜드입니다.",
} as const;

export const priceBasisLabel: Record<PriceBasis, string> = {
  "self-drive": "차량만 대여 · 기사 미포함",
  "with-driver": "기사 포함 요금",
};

/** 가격 옆에 붙는 기준 문구 */
export function priceBasisText(): string {
  return site.priceBasis ? priceBasisLabel[site.priceBasis] : "기사 포함 여부 상담 문의";
}
