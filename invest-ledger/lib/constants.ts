// 화면에 표시하는 이름(한글)과 DB 에 저장하는 값(영문)을 연결하는 표
// 엑셀 내보내기 때도 이 표를 그대로 사용합니다.

export const REPAYMENT_METHODS = {
  daily: "일일 상환",
  every7: "7일 단위",
  every10: "10일 단위",
  monthly: "월 단위",
  bullet: "만기 일시상환",
} as const;
export type RepaymentMethod = keyof typeof REPAYMENT_METHODS;

export const INVESTMENT_STATUSES = {
  active: "진행중",
  completed: "완료",
  cancelled: "취소",
} as const;
export type InvestmentStatus = keyof typeof INVESTMENT_STATUSES;

/** 회수기간 빠른 선택 버튼 (일) */
export const TERM_PRESETS = [60, 100, 120] as const;
export const DEFAULT_TERM_DAYS = 100;

export function isRepaymentMethod(v: string): v is RepaymentMethod {
  return v in REPAYMENT_METHODS;
}
export function isInvestmentStatus(v: string): v is InvestmentStatus {
  return v in INVESTMENT_STATUSES;
}
