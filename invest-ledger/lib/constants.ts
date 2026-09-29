export const REPAYMENT_METHODS = [
  { value: "daily", label: "일일 상환" },
  { value: "every7", label: "7일 단위" },
  { value: "every10", label: "10일 단위" },
  { value: "monthly", label: "월 단위" },
  { value: "bullet", label: "만기 일시상환" },
] as const;
export type RepaymentMethod = (typeof REPAYMENT_METHODS)[number]["value"];

export const PERIOD_PRESETS = [60, 100, 120] as const;
export const DEFAULT_PERIOD = 100;

export const INVESTMENT_STATUSES = [
  { value: "active", label: "진행중", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  { value: "completed", label: "완료", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { value: "suspended", label: "보류", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  { value: "cancelled", label: "취소", className: "bg-gray-100 text-gray-500 ring-gray-200" },
] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number]["value"];

export function methodLabel(v: string): string {
  return REPAYMENT_METHODS.find((m) => m.value === v)?.label ?? v;
}

export function statusInfo(v: string) {
  return INVESTMENT_STATUSES.find((s) => s.value === v) ?? INVESTMENT_STATUSES[0];
}
