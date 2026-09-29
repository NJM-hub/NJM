// 투자 관련 자동 계산 (화면 미리보기용. DB 뷰 investment_summary 도 같은 규칙으로 계산합니다)
import type { RepaymentMethod } from "./constants";
import { addDays } from "./dates";

/** 총 회수 예정금액 = 투자금액 × (1 + 수익률/100), 원 단위 반올림 */
export function expectedTotal(principal: number, returnRate: number): number {
  return Math.round(principal * (1 + returnRate / 100));
}

/** 회수 시작일 기본값: 투자 실행일 다음 날 */
export function defaultStartOn(executedOn: string): string {
  return addDays(executedOn, 1);
}

/**
 * 회수 만기일 기본값: 회수 시작일부터 회수기간(일)을 센 마지막 날
 * 예) 시작일 6/2, 100일 → 6/2 ~ 9/9 (시작일 포함 100일째)
 */
export function defaultMaturityOn(startOn: string, termDays: number): string {
  return addDays(startOn, Math.max(termDays, 1) - 1);
}

/** 회수 횟수 (회수계획 미리보기용) */
export function installmentCount(method: RepaymentMethod, termDays: number): number {
  const days = Math.max(Math.floor(termDays), 1);
  switch (method) {
    case "daily":
      return days;
    case "every7":
      return Math.ceil(days / 7);
    case "every10":
      return Math.ceil(days / 10);
    case "monthly":
      return Math.max(Math.round(days / 30), 1);
    case "bullet":
      return 1;
  }
}

/** 회수율(%) = 회수금액 / 총 회수 예정금액 × 100, 소수 둘째 자리 */
export function recoveryRate(paid: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.round((paid * 10000) / expected) / 100;
}
