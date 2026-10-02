// 화면에 보이는 선택지와 이름

export const PROPERTY_TYPES = {
  commercial: "상가",
  office: "사무실",
  house: "주택",
  apartment: "아파트",
  officetel: "오피스텔",
  factory: "공장",
  land: "토지",
  etc: "기타",
} as const;
export type PropertyType = keyof typeof PROPERTY_TYPES;

export const OWNER_TYPES = { individual: "개인", corporation: "법인" } as const;
export type OwnerType = keyof typeof OWNER_TYPES;

export const CONTRACT_STATUS = {
  planned: "계약 예정",
  active: "정상 계약",
  expired: "만료",
  renewed: "갱신",
  terminated: "중도해지",
} as const;
export type ContractStatus = keyof typeof CONTRACT_STATUS;

/** 화면에서 계산한 상태 (만료 예정 포함) */
export const EFFECTIVE_STATUS = {
  planned: "계약 예정",
  active: "정상",
  expiring: "만료 예정",
  expired: "만료",
  renewed: "갱신",
  terminated: "중도해지",
} as const;
export type EffectiveStatus = keyof typeof EFFECTIVE_STATUS;

export const PAYMENT_METHODS = {
  transfer: "계좌이체",
  cash: "현금",
  card: "카드",
  cms: "CMS 자동이체",
  offset: "보증금 상계",
  etc: "기타",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const RATE_TYPES = { fixed: "고정금리", variable: "변동금리" } as const;
export type RateType = keyof typeof RATE_TYPES;

export const REPAYMENT_TYPES = {
  bullet: "만기일시상환",
  equal_payment: "원리금균등상환",
  equal_principal: "원금균등상환",
  grace: "거치 후 분할상환",
} as const;
export type RepaymentType = keyof typeof REPAYMENT_TYPES;

export const EXPENSE_CATEGORIES = {
  loan_interest: "대출이자",
  property_tax: "재산세",
  comprehensive_tax: "종부세",
  maintenance: "관리비",
  electricity: "전기",
  water: "수도",
  insurance: "보험",
  repair: "수선비",
  brokerage: "중개수수료",
  legal: "법무비용",
  cleaning: "청소비",
  etc: "기타",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const DOCUMENT_CATEGORIES = {
  lease: "임대차계약서",
  registry: "등기부등본",
  building_ledger: "건축물대장",
  business_license: "사업자등록증",
  tenant: "임차인 서류",
  loan: "대출서류",
  tax: "세금 관련 서류",
  etc: "기타 문서",
} as const;
export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export const DEPOSIT_STATUS = { held: "보관 중", partial: "일부 반환", returned: "반환 완료" } as const;
export type DepositStatus = keyof typeof DEPOSIT_STATUS;

export const NOTIFICATION_KINDS = {
  rent_due: "월세 납부일",
  rent_overdue: "월세 미납",
  contract_expiry: "계약 만료",
  deposit_return: "보증금 반환",
  loan_maturity: "대출 만기",
  loan_interest: "대출이자 납부",
  vacancy: "공실 발생",
} as const;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export const AGING_BUCKETS = ["1~30일", "31~60일", "61~90일", "90일 이상"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** 업로드 가능한 파일 */
export const UPLOAD_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel 요청 크기 제한(4.5MB) 안쪽

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined): string {
  return key && key in map ? map[key as keyof T] : (key ?? "-");
}
