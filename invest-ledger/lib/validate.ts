import { REPAYMENT_METHODS, INVESTMENT_STATUSES } from "@/lib/constants";
import { isDate } from "@/lib/dates";
import { parseMoney } from "@/lib/format";

export type CustomerInput =
  | { mode: "existing"; customerId: string }
  | { mode: "new"; name: string; phone: string };

export type InvestmentInput = {
  customer: CustomerInput;
  investmentNo: string | null; // 비우면 자동 번호
  targetName: string;
  executedOn: string;
  principal: number;
  returnRate: number;
  repaymentMethod: string;
  periodDays: number;
  startOn: string;
  maturityOn: string;
  memo: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; fieldErrors: Record<string, string> };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** 전화번호: 숫자만 남긴 뒤 010-1234-5678 형태로 정리 */
export function normalizePhone(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10 && d.startsWith("02")) return `02-${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9 && d.startsWith("02")) return `02-${d.slice(2, 5)}-${d.slice(5)}`;
  return s.trim();
}

export function parseInvestmentForm(fd: FormData): Result<InvestmentInput> {
  const e: Record<string, string> = {};

  let customer: CustomerInput;
  if (str(fd, "customer_mode") === "existing") {
    const customerId = str(fd, "customer_id");
    if (!customerId) e.customer_id = "고객을 선택하세요.";
    customer = { mode: "existing", customerId };
  } else {
    const name = str(fd, "customer_name");
    if (!name) e.customer_name = "고객명을 입력하세요.";
    customer = { mode: "new", name, phone: normalizePhone(str(fd, "customer_phone")) };
  }

  const investmentNo = str(fd, "investment_no") || null;
  if (investmentNo && investmentNo.length > 30) e.investment_no = "투자번호는 30자 이내로 입력하세요.";

  const targetName = str(fd, "target_name");
  if (!targetName) e.target_name = "투자 대상명을 입력하세요.";

  const executedOn = str(fd, "executed_on");
  if (!isDate(executedOn)) e.executed_on = "투자 실행일을 선택하세요.";

  const principal = parseMoney(str(fd, "principal"));
  if (!(principal > 0)) e.principal = "투자 실행금액을 숫자로 입력하세요.";
  else if (principal >= 1e15) e.principal = "금액이 너무 큽니다.";

  const rateRaw = str(fd, "return_rate");
  const returnRate = Number(rateRaw);
  if (rateRaw === "" || !Number.isFinite(returnRate) || returnRate < 0 || returnRate >= 1000) {
    e.return_rate = "수익률을 0 이상의 숫자로 입력하세요. (예: 20)";
  }

  const repaymentMethod = str(fd, "repayment_method");
  if (!REPAYMENT_METHODS.some((m) => m.value === repaymentMethod)) e.repayment_method = "회수방식을 선택하세요.";

  const periodDays = Number(str(fd, "period_days"));
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 3650) {
    e.period_days = "회수기간을 1~3650일 사이로 입력하세요.";
  }

  const startOn = str(fd, "start_on");
  if (!isDate(startOn)) e.start_on = "회수 시작일을 선택하세요.";
  const maturityOn = str(fd, "maturity_on");
  if (!isDate(maturityOn)) e.maturity_on = "회수 만기일을 선택하세요.";
  else if (isDate(startOn) && maturityOn < startOn) e.maturity_on = "만기일은 시작일 이후여야 합니다.";

  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return {
    ok: true,
    data: {
      customer, investmentNo, targetName, executedOn, principal, returnRate,
      repaymentMethod, periodDays, startOn, maturityOn, memo: str(fd, "memo"),
    },
  };
}

export function isInvestmentStatus(s: string): boolean {
  return INVESTMENT_STATUSES.some((x) => x.value === s);
}
