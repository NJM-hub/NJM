// DB 테이블/뷰와 같은 모양의 타입 (supabase/migrations/0001_init.sql 참고)

export type Customer = {
  id: string;
  name: string;
  phone: string;
  memo: string;
  status: "active" | "inactive";
  created_at: string;
};

export type Investment = {
  id: string;
  investment_no: string;
  customer_id: string;
  target_name: string;
  executed_on: string;
  principal: number;
  return_rate: number;
  expected_total: number;
  repayment_method: string;
  period_days: number;
  start_on: string;
  maturity_on: string;
  status: string;
  status_reason: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

/** v_investment_summary: 투자 + 고객 + 자동 계산 값 */
export type InvestmentSummary = Investment & {
  customer_name: string;
  customer_phone: string;
  collected_amount: number;
  remaining_amount: number;
  recovery_rate: number;
  overdue_amount: number;
  overdue_count: number;
  schedule_count: number;
  last_paid_on: string | null;
  elapsed_days: number;
  remaining_days: number;
};

/** 폼 처리 결과 (화면에 오류 표시용) */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};
