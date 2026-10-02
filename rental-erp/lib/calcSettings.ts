// 계산 기준 설정 (설정 화면에서 수정, DB settings 표의 'calc' 키에 저장)

export const FORMULA_VARS = {
  monthlyNet: ["월세수입", "기타수입", "운영비", "대출이자"],
  annualNet: ["월순수익"],
  equity: ["매입가격", "취득비용", "리모델링비용", "기타투자금", "대출잔액", "보증금"],
  vacancyLoss: ["예상월세", "공실일수", "기준일수"],
} as const;

export const FORMULA_LABELS: Record<keyof typeof FORMULA_VARS, string> = {
  monthlyNet: "월 순수익",
  annualNet: "연 순수익",
  equity: "자기자본",
  vacancyLoss: "공실 손실",
};

export type CalcSettings = {
  /** 계산식 */
  formulas: Record<keyof typeof FORMULA_VARS, string>;
  /** 공실 손실 계산의 한 달 기준 일수 */
  vacancyDayBase: number;
  /** 월 이자 계산: monthly = 잔액×금리÷12, daily = 잔액×금리÷365×그 달 일수 */
  interestMethod: "monthly" | "daily";
  /** 관리비 수입을 '기타 임대수입'으로 본다 */
  maintenanceAsIncome: boolean;
  /** 부가세를 수입에 포함 */
  vatAsIncome: boolean;
  /** 운영비 기준: 최근 12개월 실제 비용 평균 */
  opexMonths: number;
  /** 계약 만료 알림 (일 전) */
  expiryAlertDays: number[];
  /** 보증금 반환 알림 (종료 며칠 전부터) */
  depositAlertDays: number;
  /** 대출 만기 알림 (일 전) */
  loanMaturityAlertDays: number;
};

export const DEFAULT_CALC: CalcSettings = {
  formulas: {
    monthlyNet: "월세수입 + 기타수입 - 운영비 - 대출이자",
    annualNet: "월순수익 * 12",
    equity: "매입가격 + 취득비용 + 리모델링비용 + 기타투자금 - 대출잔액 - 보증금",
    vacancyLoss: "예상월세 / 기준일수 * 공실일수",
  },
  vacancyDayBase: 30,
  interestMethod: "monthly",
  maintenanceAsIncome: true,
  vatAsIncome: false,
  opexMonths: 12,
  expiryAlertDays: [90, 60, 30, 7],
  depositAlertDays: 60,
  loanMaturityAlertDays: 90,
};

/** 저장된 값과 기본값 합치기 (빠진 항목은 기본값) */
export function mergeCalc(v: unknown): CalcSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<CalcSettings>;
  return {
    ...DEFAULT_CALC,
    ...o,
    formulas: { ...DEFAULT_CALC.formulas, ...(o.formulas ?? {}) },
    expiryAlertDays:
      Array.isArray(o.expiryAlertDays) && o.expiryAlertDays.length
        ? [...o.expiryAlertDays].map(Number).filter((n) => n > 0).sort((a, b) => b - a)
        : DEFAULT_CALC.expiryAlertDays,
  };
}
