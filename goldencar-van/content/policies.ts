// ─────────────────────────────────────────────────────────────
// 요금 조건 · 이용 안내 · FAQ · 약관 — 확정된 내용만 채워 주세요.
// value / body 를 빈 문자열("")로 두면 화면에 '상담 문의'로 표시됩니다.
// ─────────────────────────────────────────────────────────────

export type InfoItem = { label: string; value: string };

/** 렌트 요금 섹션의 세부 조건 */
export const rateConditions: InfoItem[] = [
  { label: "1일 이용 기준", value: "" }, // 예: "24시간 (대여 시각 기준)"
  { label: "추가 이용 시간 요금", value: "" },
  { label: "장기 렌트 할인", value: "" },
  { label: "보증금", value: "" },
  { label: "보험 및 면책 조건", value: "" },
  { label: "차량 인수 및 반납 방법", value: "" },
  { label: "주행거리 제한", value: "" },
  { label: "유류비 · 통행료", value: "" },
];

/** 예약 방법 (단계) — 실제 운영 방식에 맞게 고쳐 주세요 */
export const bookingSteps: { title: string; body: string }[] = [
  { title: "차량 선택", body: "스타리아 하이브리드 또는 쏠라티 중 원하는 차량을 고릅니다." },
  { title: "예약 문의", body: "예약 문의 양식, 전화, 카카오톡 중 편한 방법으로 날짜를 알려 주세요." },
  { title: "상담 · 확정", body: "담당자가 이용 가능 여부와 대여 조건을 안내하고 예약을 확정합니다." },
  { title: "차량 인수", body: "약속한 일시와 장소에서 차량을 인수합니다." },
];

/** 이용 안내 항목 (펼쳐 보기) */
export const guideSections: InfoItem[] = [
  { label: "차량 인수 및 반납 절차", value: "" },
  { label: "운전면허 및 대여 자격", value: "" },
  { label: "보험 안내", value: "" },
  { label: "렌트 취소 및 변경", value: "" },
  { label: "추가 요금 안내", value: "" },
];

/** 자주 묻는 질문 — 답변이 정해진 질문만 남겨 주세요 */
export const faqs: { q: string; a: string }[] = [
  { q: "요금에 기사님이 포함되나요?", a: "" }, // content/site.ts 의 priceBasis 와 같게 적어 주세요
  { q: "예약은 며칠 전까지 해야 하나요?", a: "" },
  { q: "공항에서 차량을 받을 수 있나요?", a: "" },
  { q: "장기 렌트도 가능한가요?", a: "" },
];

/** 예약 문의 시 개인정보 수집 안내 (양식 동의란에 표시) */
export const inquiryPrivacy = {
  items: "이름, 연락처, 렌트 희망 차량·일정, 이용 목적, 요청사항",
  purpose: "렌트 예약 상담 및 연락",
  retention: "", // 예: "상담 완료 후 1년" — 비워 두면 '개인정보처리방침에 따름'
};

/** 개인정보처리방침 · 이용약관 본문 (빈 문자열이면 '준비 중' 안내) */
export const legal = {
  privacy: "",
  terms: "",
};
