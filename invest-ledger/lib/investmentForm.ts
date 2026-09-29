// 투자 등록/수정 폼 입력값 검사. 화면과 서버가 같은 규칙을 씁니다.
import { defaultMaturityOn, defaultStartOn } from "./calc";
import {
  DEFAULT_TERM_DAYS,
  isInvestmentStatus,
  isRepaymentMethod,
  type InvestmentStatus,
  type RepaymentMethod,
} from "./constants";
import { isValidDate, todayKst } from "./dates";
import { parseAmount } from "./format";

export type InvestmentInput = {
  investment_no: string | null;
  executed_on: string;
  principal: number;
  target_name: string;
  customer_name: string;
  customer_phone: string | null;
  return_rate: number;
  repayment_method: RepaymentMethod;
  term_days: number;
  start_on: string;
  maturity_on: string;
  memo: string | null;
  status: InvestmentStatus;
};

/** 폼 입력칸 값 (모두 문자열) */
export type InvestmentFormValues = {
  investment_no: string;
  executed_on: string;
  principal: string;
  target_name: string;
  customer_name: string;
  customer_phone: string;
  return_rate: string;
  repayment_method: string;
  term_days: string;
  start_on: string;
  maturity_on: string;
  memo: string;
  status: string;
};

export function emptyInvestmentValues(): InvestmentFormValues {
  const executed = todayKst();
  const start = defaultStartOn(executed);
  return {
    investment_no: "",
    executed_on: executed,
    principal: "",
    target_name: "",
    customer_name: "",
    customer_phone: "",
    return_rate: "20",
    repayment_method: "daily",
    term_days: String(DEFAULT_TERM_DAYS),
    start_on: start,
    maturity_on: defaultMaturityOn(start, DEFAULT_TERM_DAYS),
    memo: "",
    status: "active",
  };
}

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<keyof InvestmentInput, string>>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export function parseInvestmentForm(fd: FormData):
  | { ok: true; data: InvestmentInput }
  | { ok: false; errors: NonNullable<FormState["errors"]> } {
  const errors: NonNullable<FormState["errors"]> = {};

  const executed_on = text(fd, "executed_on");
  if (!isValidDate(executed_on)) errors.executed_on = "투자 실행일을 입력하세요.";

  const principal = parseAmount(text(fd, "principal"));
  if (!Number.isFinite(principal) || principal <= 0) errors.principal = "투자 실행금액을 숫자로 입력하세요.";
  else if (principal > 1_000_000_000_000_000) errors.principal = "금액이 너무 큽니다.";

  const target_name = text(fd, "target_name");
  if (!target_name) errors.target_name = "투자 대상명을 입력하세요.";

  const customer_name = text(fd, "customer_name");
  if (!customer_name) errors.customer_name = "고객명을 입력하세요.";

  const rateText = text(fd, "return_rate").replace("%", "");
  const return_rate = rateText === "" ? 0 : Number(rateText);
  if (!Number.isFinite(return_rate) || return_rate < 0 || return_rate > 1000)
    errors.return_rate = "수익률은 0 ~ 1000 사이 숫자로 입력하세요.";

  const method = text(fd, "repayment_method");
  if (!isRepaymentMethod(method)) errors.repayment_method = "회수방식을 선택하세요.";

  const term_days = Number(text(fd, "term_days"));
  if (!Number.isInteger(term_days) || term_days < 1 || term_days > 3650)
    errors.term_days = "회수기간은 1 ~ 3650일 사이로 입력하세요.";

  const start_on = text(fd, "start_on");
  if (!isValidDate(start_on)) errors.start_on = "회수 시작일을 입력하세요.";
  else if (isValidDate(executed_on) && start_on < executed_on)
    errors.start_on = "회수 시작일은 투자 실행일보다 빠를 수 없습니다.";

  const maturity_on = text(fd, "maturity_on");
  if (!isValidDate(maturity_on)) errors.maturity_on = "회수 만기일을 입력하세요.";
  else if (isValidDate(start_on) && maturity_on < start_on)
    errors.maturity_on = "회수 만기일은 회수 시작일보다 빠를 수 없습니다.";

  const statusText = text(fd, "status") || "active";
  if (!isInvestmentStatus(statusText)) errors.status = "상태를 선택하세요.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      investment_no: text(fd, "investment_no") || null,
      executed_on,
      principal,
      target_name,
      customer_name,
      customer_phone: text(fd, "customer_phone") || null,
      return_rate,
      repayment_method: method as RepaymentMethod,
      term_days,
      start_on,
      maturity_on,
      memo: text(fd, "memo") || null,
      status: statusText as InvestmentStatus,
    },
  };
}

/** 오류가 났을 때 입력한 값을 그대로 돌려주기 위해 사용 */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}
