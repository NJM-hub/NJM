import type { InvestmentStatus, RepaymentMethod } from "./constants";

/** investment_summary 뷰 한 줄 (투자 1건 + 자동 계산값) */
export type InvestmentSummary = {
  id: string;
  investment_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  target_name: string;
  executed_on: string; // YYYY-MM-DD
  principal: number; // 투자 실행금액
  return_rate: number; // 수익률 %
  expected_total: number; // 총 회수 예정금액
  repayment_method: RepaymentMethod;
  term_days: number;
  start_on: string;
  maturity_on: string;
  memo: string | null;
  status: InvestmentStatus;
  created_at: string;
  updated_at: string;
  paid_total: number; // 현재까지 회수한 금액
  remaining_amount: number; // 남은 회수금액
  recovery_rate: number; // 회수율 %
  elapsed_days: number; // 경과일수
  remaining_days: number; // 남은 회수기간(일)
  days_to_maturity: number; // 만기까지 남은 일수 (지나면 음수)
  last_paid_on: string | null;
  due_until_yesterday: number;
  overdue_amount: number; // 연체금액
  schedule_count: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  status: "active" | "inactive";
};
