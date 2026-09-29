import { addDays } from "@/lib/dates";

/** 총 회수 예정금액 = 투자금액 × (1 + 수익률/100), 원 단위 반올림 (DB 의 expected_total 과 같은 식) */
export function expectedTotal(principal: number, ratePercent: number): number {
  if (!Number.isFinite(principal) || !Number.isFinite(ratePercent)) return 0;
  return Math.round(principal * (1 + ratePercent / 100));
}

/** 회수 시작일 기본값: 투자 실행일 다음 날 */
export function defaultStartOn(executedOn: string): string {
  return addDays(executedOn, 1);
}

/** 회수 만기일 = 시작일 + 회수기간 - 1 (예: 100일이면 시작일 포함 100일째 되는 날) */
export function maturityOn(startOn: string, periodDays: number): string {
  return addDays(startOn, Math.max(periodDays, 1) - 1);
}

/** 회수율(%) = 회수금액 ÷ 총 회수 예정금액 × 100, 소수 둘째 자리 */
export function recoveryRate(collected: number, expected: number): number {
  if (!expected) return 0;
  return Math.round((collected / expected) * 10000) / 100;
}

export function remaining(expected: number, collected: number): number {
  return Math.max(expected - collected, 0);
}
