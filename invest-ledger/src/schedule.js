// 회수 스케줄 생성기
// - 기간 단위: 일(day) / 주(week) / 개월(month)
// - 회수주기 단위: 일(day) / 주(week) / 개월(month)
// - 회수방식은 METHODS 레지스트리에 추가하는 것만으로 확장 가능

import { addDays, addMonths, diffDays, isDate } from "./dates.js";
import { calcProfit, splitEven, splitWeighted, sum, toWon } from "./money.js";

export const UNIT_LABEL = { day: "일", week: "주", month: "개월" };

export function termLabel(value, unit) {
  return `${value}${UNIT_LABEL[unit] ?? unit}`;
}

export function cycleLabel(value, unit) {
  if (unit === "day" && value === 1) return "매일";
  if (unit === "day" && value === 7) return "7일마다(매주)";
  if (unit === "week" && value === 1) return "매주";
  if (unit === "month" && value === 1) return "매월";
  if (unit === "day") return `${value}일마다`;
  if (unit === "week") return `${value}주마다`;
  return `${value}개월마다`;
}

// 회수방식 레지스트리. 새 방식은 여기에 항목만 추가하면 된다.
//   allocate({ principal, profit, total, n }) -> 회차별 금액 배열 (합계 = total)
//   singlePayment: true 면 만기일 1회 상환
//   allowCustomAmount: 1회 회수금액 직접 지정 허용
export const METHODS = {
  equal_total: {
    label: "원금+수익 균등회수",
    allowCustomAmount: true,
    allocate: ({ total, n }) => splitEven(total, n),
  },
  equal_principal: {
    label: "원금 균등회수",
    // 원금은 균등, 수익은 남은 원금에 비례해 앞 회차에 많이 배분(체감식)
    allocate: ({ principal, profit, n }) => {
      const p = splitEven(principal, n);
      const weights = Array.from({ length: n }, (_, i) => n - i);
      const f = splitWeighted(profit, weights);
      return p.map((v, i) => v + f[i]);
    },
  },
  equal_profit: {
    label: "수익 균등회수 (원금 만기상환)",
    allocate: ({ principal, profit, n }) => {
      const f = splitEven(profit, n);
      f[n - 1] += principal;
      return f;
    },
  },
  bullet: {
    label: "만기 일시상환",
    singlePayment: true,
    allocate: ({ total }) => [total],
  },
  manual: {
    label: "직접 회수금액 입력",
    allowCustomAmount: true,
    // 초기값은 균등분할, 상세화면에서 회차별 금액을 직접 수정
    allocate: ({ total, n }) => splitEven(total, n),
  },
};

function unitDays(unit) {
  return unit === "week" ? 7 : unit === "day" ? 1 : null;
}

function posInt(v, name, errors) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${name}을(를) 1 이상의 정수로 입력하세요.`);
    return null;
  }
  return n;
}

// 입력값을 검증·정규화한다. 오류는 errors 배열로 반환.
export function normalizeTerms(input) {
  const errors = [];
  const t = {};
  t.execDate = input.execDate;
  if (!isDate(t.execDate)) errors.push("실행일을 입력하세요.");
  t.principal = toWon(input.principal);
  if (!Number.isInteger(t.principal) || t.principal <= 0) errors.push("실행금액을 입력하세요.");
  t.rate = input.rate === "" || input.rate === null || input.rate === undefined ? "0" : String(input.rate).trim();
  if (!/^\d+(\.\d+)?$/.test(t.rate)) errors.push("약정 수익률은 0 이상의 숫자로 입력하세요.");
  t.termValue = posInt(input.termValue, "투자기간", errors);
  t.termUnit = input.termUnit;
  if (!UNIT_LABEL[t.termUnit]) errors.push("투자기간 단위를 선택하세요.");
  t.method = input.method in METHODS ? input.method : null;
  if (!t.method) errors.push("회수방식을 선택하세요.");
  const single = t.method && METHODS[t.method].singlePayment;
  t.cycleValue = single ? 1 : posInt(input.cycleValue, "회수주기", errors);
  t.cycleUnit = single ? "day" : input.cycleUnit;
  if (!UNIT_LABEL[t.cycleUnit]) errors.push("회수주기 단위를 선택하세요.");
  t.firstDueDate = input.firstDueDate || t.execDate;
  if (input.firstDueDate && !isDate(input.firstDueDate)) errors.push("첫 회수일 형식이 올바르지 않습니다.");
  if (isDate(t.firstDueDate) && isDate(t.execDate) && t.firstDueDate < t.execDate)
    errors.push("첫 회수일은 실행일보다 빠를 수 없습니다.");
  t.totalOverride = toWon(input.totalExpected);
  if (Number.isNaN(t.totalOverride) || (t.totalOverride !== null && t.totalOverride <= 0))
    errors.push("총 회수예정금액이 올바르지 않습니다.");
  t.installmentAmount = toWon(input.installmentAmount);
  if (Number.isNaN(t.installmentAmount) || (t.installmentAmount !== null && t.installmentAmount <= 0))
    errors.push("1회 회수금액이 올바르지 않습니다.");
  t.expiryOverride = input.expiryDate || null;
  if (t.expiryOverride && !isDate(t.expiryOverride)) errors.push("만료일 형식이 올바르지 않습니다.");
  return { terms: t, errors };
}

// 약정 조건 → 회수 계획
export function buildPlan(input) {
  const { terms: t, errors } = normalizeTerms(input);
  if (errors.length) return { ok: false, errors };

  const profitCalc = calcProfit(t.principal, t.rate);
  const total = t.totalOverride ?? t.principal + profitCalc;
  const profit = total - t.principal;

  // 회수 기간: [첫 회수일, 첫 회수일 + 기간)
  const start = t.firstDueDate;
  const endExcl =
    t.termUnit === "month" ? addMonths(start, t.termValue) : addDays(start, t.termValue * unitDays(t.termUnit));
  const periodEnd = addDays(endExcl, -1);
  const termDays = diffDays(endExcl, start);
  const expiryDate = t.expiryOverride || periodEnd;
  if (expiryDate < start) return { ok: false, errors: ["만료일이 첫 회수일보다 빠릅니다."] };

  // 회수 예정일 생성
  const method = METHODS[t.method];
  let dates = [];
  if (method.singlePayment) {
    dates = [expiryDate];
  } else {
    for (let k = 0; ; k++) {
      const d =
        t.cycleUnit === "month"
          ? addMonths(start, k * t.cycleValue)
          : addDays(start, k * t.cycleValue * unitDays(t.cycleUnit));
      if (d >= endExcl && k > 0) break;
      dates.push(d);
      if (dates.length > 5000) return { ok: false, errors: ["회차가 너무 많습니다 (최대 5000회)."] };
    }
  }
  const n = dates.length;

  // 회차별 금액
  let amounts;
  if (t.installmentAmount && method.allowCustomAmount && n > 1) {
    const last = total - t.installmentAmount * (n - 1);
    if (last <= 0) {
      return {
        ok: false,
        errors: [
          `1회 회수금액 ${t.installmentAmount.toLocaleString()}원 × ${n - 1}회가 총 회수예정금액을 넘습니다. 금액을 줄이거나 기간을 조정하세요.`,
        ],
      };
    }
    amounts = new Array(n).fill(t.installmentAmount);
    amounts[n - 1] = last;
  } else {
    amounts = method.allocate({ principal: t.principal, profit, total, n });
  }
  if (sum(amounts) !== total || amounts.some((a) => !Number.isInteger(a) || a < 0)) {
    return { ok: false, errors: ["회차 금액 계산 오류 (합계 불일치)"] };
  }

  return {
    ok: true,
    terms: t,
    principal: t.principal,
    rate: t.rate,
    profit,
    profitCalc,
    totalExpected: total,
    termDays,
    periodEnd,
    expiryDate,
    count: n,
    perAmount: amounts[0],
    lastAmount: amounts[n - 1],
    installments: dates.map((d, i) => ({ seq: i + 1, dueDate: d, amount: amounts[i] })),
  };
}
