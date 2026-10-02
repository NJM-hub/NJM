// 임대사업 계산 엔진 (순수 함수: DB 없이 테스트 가능)
// 대시보드·부동산별 손익·수익률·미납·공실·알림·그래프·AI 질문 답변이 모두 이 결과(Snapshot)를 쓴다.

import type { CalcSettings } from "@/lib/calcSettings";
import type { AgingBucket, EffectiveStatus } from "@/lib/constants";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  dueDateOf,
  monthEnd,
  monthStart,
  parts,
  type ISODate,
} from "@/lib/dates";
import { evaluate } from "@/lib/formula";
import type {
  Allocation,
  Charge,
  Contract,
  Dataset,
  Deposit,
  Loan,
  Owner,
  Payment,
  Property,
  Tenant,
  Unit,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 계약
// ---------------------------------------------------------------------------

/** 실제 종료일 (중도해지면 해지일) */
export function effectiveEnd(c: Pick<Contract, "status" | "end_date" | "terminated_on">): ISODate {
  return c.status === "terminated" && c.terminated_on ? c.terminated_on : c.end_date;
}

/** 오늘 기준 계약 상태 (만료 예정 포함) */
export function effectiveStatus(c: Contract, today: ISODate, expiringDays = 90): EffectiveStatus {
  if (c.status === "terminated" || c.status === "renewed") return c.status;
  if (c.status === "expired") return "expired";
  if (c.start_date > today) return "planned";
  if (c.end_date < today) return "expired";
  if (daysBetween(today, c.end_date) <= expiringDays) return "expiring";
  return "active";
}

/** 그 날짜에 호실을 쓰고 있는 계약인가 */
export function occupiesOn(c: Contract, d: ISODate): boolean {
  return c.start_date <= d && effectiveEnd(c) >= d;
}

/** 만료 알림 등급: 30일 이내 빨강, 60일 주황, 90일 노랑 */
export function expiryLevel(daysLeft: number): "red" | "orange" | "yellow" | null {
  if (daysLeft <= 30) return "red";
  if (daysLeft <= 60) return "orange";
  if (daysLeft <= 90) return "yellow";
  return null;
}

// ---------------------------------------------------------------------------
// 월세 자동 청구
// ---------------------------------------------------------------------------

export type PlannedCharge = {
  contract_id: string;
  billing_month: ISODate;
  due_date: ISODate;
  rent_amount: number;
  maintenance_amount: number;
  vat_amount: number;
  amount: number;
};

/**
 * 오늘까지 만들어져 있어야 할 청구 목록.
 * 청구 시작 월(없으면 계약 시작 월)부터 이번 달(또는 계약 종료 월)까지 매월 1건.
 * 이번 달 청구는 1일에 미리 생성되고, 납부일이 지나도 입금이 없으면 미납이 된다.
 */
export function planCharges(c: Contract, today: ISODate): PlannedCharge[] {
  if (c.status === "planned" && c.start_date > today) return [];
  const from = monthStart(c.billing_from && c.billing_from > c.start_date ? c.billing_from : c.start_date);
  const last = monthStart(effectiveEnd(c) < today ? effectiveEnd(c) : today);
  const out: PlannedCharge[] = [];
  for (let m = from; m <= last; m = addMonths(m, 1)) {
    const amount = c.monthly_rent + c.maintenance_fee + c.vat_amount;
    if (amount <= 0) continue;
    out.push({
      contract_id: c.id,
      billing_month: m,
      due_date: dueDateOf(m, c.pay_day),
      rent_amount: c.monthly_rent,
      maintenance_amount: c.maintenance_fee,
      vat_amount: c.vat_amount,
      amount,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 입금 배분: 입금일 순서대로, 지정한 청구월 먼저 → 남으면 가장 오래된 미납부터
// ---------------------------------------------------------------------------

export function allocate(
  payments: Pick<Payment, "id" | "charge_id" | "paid_date" | "amount" | "created_at">[],
  charges: Pick<Charge, "id" | "due_date" | "billing_month" | "amount">[],
): { allocations: Allocation[]; paid: Map<string, number>; credit: number } {
  const order = [...charges].sort((a, b) => a.billing_month.localeCompare(b.billing_month));
  const remaining = new Map(order.map((c) => [c.id, c.amount]));
  const allocations: Allocation[] = [];
  let credit = 0;
  const pays = [...payments].sort(
    (a, b) => a.paid_date.localeCompare(b.paid_date) || a.created_at.localeCompare(b.created_at),
  );
  for (const p of pays) {
    let left = p.amount;
    const take = (chargeId: string) => {
      const r = remaining.get(chargeId) ?? 0;
      const a = Math.min(r, left);
      if (a <= 0) return;
      remaining.set(chargeId, r - a);
      left -= a;
      const prev = allocations.find((x) => x.payment_id === p.id && x.charge_id === chargeId);
      if (prev) prev.amount += a;
      else allocations.push({ payment_id: p.id, charge_id: chargeId, amount: a });
    };
    if (p.charge_id && remaining.has(p.charge_id)) take(p.charge_id);
    for (const c of order) {
      if (left <= 0) break;
      take(c.id);
    }
    credit += left;
  }
  const paid = new Map(order.map((c) => [c.id, c.amount - (remaining.get(c.id) ?? 0)]));
  return { allocations, paid, credit };
}

export type ChargeState = "paid" | "partial" | "overdue" | "scheduled";

export function chargeState(c: Pick<Charge, "amount" | "paid_amount" | "due_date">, today: ISODate): ChargeState {
  if (c.paid_amount >= c.amount) return "paid";
  if (c.due_date < today) return "overdue";
  return c.paid_amount > 0 ? "partial" : "scheduled";
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return "1~30일";
  if (days <= 60) return "31~60일";
  if (days <= 90) return "61~90일";
  return "90일 이상";
}

// ---------------------------------------------------------------------------
// 대출
// ---------------------------------------------------------------------------

/** 월 이자. 10억 × 5% → 연 5,000만원, 월 4,166,667원 */
export function monthlyInterest(
  balance: number,
  ratePct: number,
  method: CalcSettings["interestMethod"] = "monthly",
  month?: ISODate,
): number {
  if (method === "daily" && month) {
    const [y, m] = parts(month);
    return Math.round((balance * ratePct) / 100 / 365 * daysInMonth(y, m));
  }
  return Math.round((balance * ratePct) / 100 / 12);
}

/** 원리금균등 월 상환액 */
export function annuityPayment(principal: number, ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (months <= 0) return 0;
  if (r === 0) return Math.round(principal / months);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

/** 이번 달 예상 상환액 (원금 + 이자) */
export function expectedMonthlyPayment(l: Loan, today: ISODate, method: CalcSettings["interestMethod"]): number {
  if (l.monthly_payment) return l.monthly_payment;
  const interest = monthlyInterest(l.balance, l.interest_rate, method, today);
  if (l.repayment_type === "equal_payment" && l.maturity_date) {
    const months = Math.max(1, Math.round(daysBetween(today, l.maturity_date) / 30.4));
    return annuityPayment(l.balance, l.interest_rate, months);
  }
  if (l.repayment_type === "equal_principal" && l.maturity_date) {
    const months = Math.max(1, Math.round(daysBetween(today, l.maturity_date) / 30.4));
    return Math.round(l.balance / months) + interest;
  }
  return interest;
}

// ---------------------------------------------------------------------------
// 스냅샷 (대시보드 전체)
// ---------------------------------------------------------------------------

export type UnitView = {
  unit: Unit;
  property: Property;
  contract: Contract | null; // 지금 쓰는 계약
  tenant: Tenant | null;
  upcoming: Contract | null; // 아직 시작 안 한 다음 계약
  occupied: boolean;
  vacancyStart: ISODate | null;
  vacancyDays: number;
  vacancyLoss: number;
  unpaid: number;
};

export type ArrearItem = {
  contract: Contract;
  tenant: Tenant | null;
  unit: Unit | null;
  property: Property | null;
  charges: { charge: Charge; unpaid: number; days: number }[];
  total: number;
  oldestDue: ISODate;
  days: number; // 가장 오래된 미납의 경과일
  bucket: AgingBucket;
};

export type ExpiringItem = {
  contract: Contract;
  tenant: Tenant | null;
  unit: Unit | null;
  property: Property | null;
  daysLeft: number;
  level: "red" | "orange" | "yellow";
};

export type PropertyMetrics = {
  property: Property;
  owner: Owner | null;
  units: UnitView[];
  unitCount: number;
  occupiedCount: number;
  vacantCount: number;
  deposits: number; // 현재 계약 보증금 합계
  monthlyRent: number;
  otherIncome: number; // 관리비·부가세 (설정에 따라)
  loanBalance: number;
  loanPrincipal: number;
  loanCount: number;
  monthlyInterest: number;
  monthlyOpex: number; // 최근 N개월 비용(이자 제외) 월평균
  monthlyNet: number;
  annualNet: number;
  annualRent: number;
  equity: number;
  investedTotal: number; // 매입가 + 취득·리모델링·기타
  simpleYield: number | null; // 연 임대수익 ÷ 매입가
  leveragedYield: number | null; // (연 임대수익 - 연 이자 - 연 운영비) ÷ 자기자본
  cashYield: number | null; // 최근 12개월 실제 현금흐름 ÷ 실제 투입 자기자본
  actualCashflow12m: number;
  actualEquity: number;
  monthBilled: number;
  monthCollected: number;
  unpaid: number; // 납부일 지난 미납 합계
  vacancyLossMonthly: number; // 공실 호실의 월 예상 손실
  vacancyLossToDate: number; // 공실 시작부터 지금까지 손실
};

export type MonthPoint = {
  month: ISODate;
  billed: number;
  collected: number;
  expenses: number; // 이자 제외 비용
  interest: number;
  net: number; // 입금 - 비용 - 이자
  outstanding: number; // 월말 미수금
  loanBalance: number;
  vacancyRate: number;
};

export type Snapshot = {
  today: ISODate;
  month: ISODate;
  settings: CalcSettings;
  owners: Owner[];
  properties: PropertyMetrics[];
  units: UnitView[];
  arrears: ArrearItem[];
  expiring: ExpiringItem[];
  totals: {
    propertyCount: number;
    unitCount: number;
    occupiedUnits: number;
    vacantUnits: number;
    leasedProperties: number; // 한 호실이라도 임대 중인 부동산
    vacantProperties: number; // 모든 호실이 공실인 부동산
    deposits: number;
    monthlyRent: number;
    otherIncome: number;
    monthBilled: number;
    monthCollected: number;
    monthOutstanding: number; // 이번 달 청구 중 아직 못 받은 금액
    unpaid: number; // 전체 미납 (납부일 지난 것)
    loanBalance: number;
    monthlyInterest: number;
    monthlyOpex: number;
    commonOpex: number; // 부동산 미지정 공통 비용 월평균
    monthlyNet: number;
    annualNet: number;
    annualNetBeforeInterest: number;
    equity: number;
    purchaseTotal: number;
    simpleYield: number | null;
    leveragedYield: number | null;
    vacancyRate: number;
    vacancyLossMonthly: number;
    todayDue: number; // 오늘 납부일인 미입금 금액
    todayDueCount: number;
    todayReceived: number;
    credit: number; // 선납(초과 입금) 합계
  };
  today_: {
    dueCharges: { charge: Charge; contract: Contract; tenant: Tenant | null; unit: Unit | null; property: Property | null; unpaid: number }[];
    receivedPayments: Payment[];
  };
  depositsDue: {
    contract: Contract;
    deposit: Deposit | null;
    tenant: Tenant | null;
    unit: Unit | null;
    property: Property | null;
    dueDate: ISODate;
    daysLeft: number;
    outstanding: number; // 아직 돌려주지 않은 보증금
  }[];
  loansDue: { loan: Loan; property: Property | null; daysLeft: number }[];
  monthly: MonthPoint[];
};

function sum<T>(xs: T[], f: (x: T) => number): number {
  let s = 0;
  for (const x of xs) s += f(x);
  return s;
}

function safeEval(formula: string, fallback: string, vars: Record<string, number>): number {
  try {
    return evaluate(formula, vars);
  } catch {
    return evaluate(fallback, vars);
  }
}

const DEFAULT_FORMULAS = {
  monthlyNet: "월세수입 + 기타수입 - 운영비 - 대출이자",
  annualNet: "월순수익 * 12",
  equity: "매입가격 + 취득비용 + 리모델링비용 + 기타투자금 - 대출잔액 - 보증금",
  vacancyLoss: "예상월세 / 기준일수 * 공실일수",
};

/**
 * 전체 계산. ownerId 를 주면 그 소유주(개인/법인)의 부동산만.
 * propertyIds 로 더 좁힐 수도 있다.
 */
export function buildSnapshot(
  ds: Dataset,
  settings: CalcSettings,
  today: ISODate,
  opts: { ownerId?: string | null; propertyId?: string | null; monthsBack?: number } = {},
): Snapshot {
  const month = monthStart(today);
  const f = settings.formulas;

  const properties = ds.properties.filter(
    (p) =>
      (opts.propertyId ? p.id === opts.propertyId : p.is_active) && (!opts.ownerId || p.owner_id === opts.ownerId),
  );
  const propIds = new Set(properties.map((p) => p.id));
  const units = ds.units.filter((u) => u.is_active && propIds.has(u.property_id));
  const unitById = new Map(ds.units.map((u) => [u.id, u]));
  const propById = new Map(ds.properties.map((p) => [p.id, p]));
  const tenantById = new Map(ds.tenants.map((t) => [t.id, t]));
  const ownerById = new Map(ds.owners.map((o) => [o.id, o]));
  const unitIds = new Set(units.map((u) => u.id));
  const contracts = ds.contracts.filter((c) => unitIds.has(c.unit_id));
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const charges = ds.charges.filter((c) => contractById.has(c.contract_id));
  const payments = ds.payments.filter((p) => contractById.has(p.contract_id));
  const loans = ds.loans.filter((l) => !l.is_closed && propIds.has(l.property_id));
  const allLoans = ds.loans.filter((l) => propIds.has(l.property_id));
  const loanIds = new Set(allLoans.map((l) => l.id));
  const loanTxs = ds.loanTxs.filter((t) => loanIds.has(t.loan_id));
  const expenses = ds.expenses.filter(
    (e) =>
      (e.property_id && propIds.has(e.property_id)) ||
      (!e.property_id && !opts.propertyId && (!opts.ownerId || e.owner_id === opts.ownerId)),
  );
  const depositByContract = new Map(ds.deposits.map((d) => [d.contract_id, d]));
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const contractsByUnit = new Map<string, Contract[]>();
  for (const c of contracts) {
    const arr = contractsByUnit.get(c.unit_id) ?? [];
    arr.push(c);
    contractsByUnit.set(c.unit_id, arr);
  }

  const unpaidOf = (c: Charge) => Math.max(0, c.amount - c.paid_amount);
  const overdueCharges = charges.filter((c) => c.due_date < today && unpaidOf(c) > 0);
  const unpaidByContract = new Map<string, number>();
  for (const c of overdueCharges) unpaidByContract.set(c.contract_id, (unpaidByContract.get(c.contract_id) ?? 0) + unpaidOf(c));

  // 호실 현황 ---------------------------------------------------------------
  const unitViews: UnitView[] = units.map((u) => {
    const list = (contractsByUnit.get(u.id) ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const current = list.find((c) => c.status !== "planned" && occupiesOn(c, today)) ?? list.find((c) => occupiesOn(c, today)) ?? null;
    const upcoming = list.find((c) => c.start_date > today && c.status !== "terminated") ?? null;
    let vacancyStart: ISODate | null = null;
    let vacancyDays = 0;
    let vacancyLoss = 0;
    if (!current) {
      const ended = list.filter((c) => effectiveEnd(c) < today).map((c) => effectiveEnd(c)).sort();
      const lastEnd = ended.length ? addDays(ended[ended.length - 1], 1) : null;
      vacancyStart = u.vacant_since ?? lastEnd ?? propById.get(u.property_id)?.purchase_date ?? null;
      if (vacancyStart && vacancyStart > today) vacancyStart = today;
      vacancyDays = vacancyStart ? Math.max(0, daysBetween(vacancyStart, today)) : 0;
      vacancyLoss = Math.round(
        safeEval(f.vacancyLoss, DEFAULT_FORMULAS.vacancyLoss, {
          예상월세: u.expected_rent,
          공실일수: vacancyDays,
          기준일수: settings.vacancyDayBase || 30,
        }),
      );
    }
    const unpaid = sum(list, (c) => unpaidByContract.get(c.id) ?? 0);
    return {
      unit: u,
      property: propById.get(u.property_id)!,
      contract: current,
      tenant: current ? (tenantById.get(current.tenant_id) ?? null) : null,
      upcoming,
      occupied: !!current,
      vacancyStart,
      vacancyDays,
      vacancyLoss,
      unpaid,
    };
  });

  // 비용 / 현금흐름 기간 ------------------------------------------------------
  const opexMonths = Math.max(1, settings.opexMonths || 12);
  const opexFrom = addMonths(month, -opexMonths); // 지난 N개월 (이번 달 제외)
  const cashFrom = addDays(today, -365);

  const incomeOf = (c: Contract) =>
    (settings.maintenanceAsIncome ? c.maintenance_fee : 0) + (settings.vatAsIncome ? c.vat_amount : 0);

  // 부동산별 ---------------------------------------------------------------
  const propertyMetrics: PropertyMetrics[] = properties.map((p) => {
    const pu = unitViews.filter((v) => v.unit.property_id === p.id);
    const current = pu.map((v) => v.contract).filter((c): c is Contract => !!c);
    const pLoans = loans.filter((l) => l.property_id === p.id);
    const pAllLoans = allLoans.filter((l) => l.property_id === p.id);
    const pContractIds = new Set(
      contracts.filter((c) => unitById.get(c.unit_id)?.property_id === p.id).map((c) => c.id),
    );
    const pCharges = charges.filter((c) => pContractIds.has(c.contract_id));
    const pPayments = payments.filter((x) => pContractIds.has(x.contract_id));
    const pExpenses = expenses.filter((e) => e.property_id === p.id);

    const deposits = sum(current, (c) => c.deposit);
    const monthlyRent = sum(current, (c) => c.monthly_rent);
    const otherIncome = sum(current, incomeOf);
    const loanBalance = sum(pLoans, (l) => l.balance);
    const loanPrincipal = sum(pLoans, (l) => l.principal);
    const mInterest = sum(pLoans, (l) => monthlyInterest(l.balance, l.interest_rate, settings.interestMethod, month));
    const opexTotal = sum(
      pExpenses.filter((e) => e.category !== "loan_interest" && e.expense_date >= opexFrom && e.expense_date < month),
      (e) => e.amount,
    );
    const monthlyOpex = Math.round(opexTotal / opexMonths);
    const monthlyNet = Math.round(
      safeEval(f.monthlyNet, DEFAULT_FORMULAS.monthlyNet, {
        월세수입: monthlyRent,
        기타수입: otherIncome,
        운영비: monthlyOpex,
        대출이자: mInterest,
      }),
    );
    const annualNet = Math.round(safeEval(f.annualNet, DEFAULT_FORMULAS.annualNet, { 월순수익: monthlyNet }));
    const equityVars = {
      매입가격: p.purchase_price,
      취득비용: p.acquisition_cost,
      리모델링비용: p.remodeling_cost,
      기타투자금: p.other_investment,
      대출잔액: loanBalance,
      보증금: deposits,
    };
    const equity = Math.round(safeEval(f.equity, DEFAULT_FORMULAS.equity, equityVars));
    const investedTotal = p.purchase_price + p.acquisition_cost + p.remodeling_cost + p.other_investment;
    const annualRent = (monthlyRent + otherIncome) * 12;

    // 실제 현금흐름 (최근 12개월): 받은 돈 - 쓴 돈(이자 포함). 원금 상환은 비용이 아니라 자기자본 추가 투입으로 본다
    const collected12 = sum(pPayments.filter((x) => x.paid_date > cashFrom && x.paid_date <= today && x.method !== "offset"), (x) => x.amount);
    const spent12 = sum(pExpenses.filter((e) => e.expense_date > cashFrom && e.expense_date <= today), (e) => e.amount);
    const pLoanIds = new Set(pAllLoans.map((l) => l.id));
    const actualCashflow12m = collected12 - spent12;
    // 실제 투입 자기자본 = 투자 총액 - 대출 원금(빌린 돈) - 받은 보증금 + 그동안 갚은 원금
    const principalRepaidTotal = sum(
      loanTxs.filter((t) => pLoanIds.has(t.loan_id) && t.tx_type === "principal"),
      (t) => t.amount,
    );
    const actualEquity = investedTotal - sum(pAllLoans, (l) => l.principal) + principalRepaidTotal - deposits;

    const monthCharges = pCharges.filter((c) => c.billing_month === month);
    const monthBilled = sum(monthCharges, (c) => c.amount);
    const monthCollected = sum(
      pPayments.filter((x) => x.paid_date >= month && x.paid_date <= today),
      (x) => x.amount,
    );
    const unpaid = sum(pCharges.filter((c) => c.due_date < today), unpaidOf);
    const vacant = pu.filter((v) => !v.occupied);

    return {
      property: p,
      owner: p.owner_id ? (ownerById.get(p.owner_id) ?? null) : null,
      units: pu,
      unitCount: pu.length,
      occupiedCount: pu.length - vacant.length,
      vacantCount: vacant.length,
      deposits,
      monthlyRent,
      otherIncome,
      loanBalance,
      loanPrincipal,
      loanCount: pLoans.length,
      monthlyInterest: mInterest,
      monthlyOpex,
      monthlyNet,
      annualNet,
      annualRent,
      equity,
      investedTotal,
      simpleYield: p.purchase_price > 0 ? (annualRent / p.purchase_price) * 100 : null,
      leveragedYield: equity > 0 ? ((annualRent - mInterest * 12 - monthlyOpex * 12) / equity) * 100 : null,
      cashYield: actualEquity > 0 ? (actualCashflow12m / actualEquity) * 100 : null,
      actualCashflow12m,
      actualEquity,
      monthBilled,
      monthCollected,
      unpaid,
      vacancyLossMonthly: sum(vacant, (v) => v.unit.expected_rent),
      vacancyLossToDate: sum(vacant, (v) => v.vacancyLoss),
    };
  });

  // 미납 ------------------------------------------------------------------
  const arrearsMap = new Map<string, ArrearItem>();
  for (const ch of overdueCharges.sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    const c = contractById.get(ch.contract_id)!;
    let item = arrearsMap.get(c.id);
    if (!item) {
      const u = unitById.get(c.unit_id) ?? null;
      item = {
        contract: c,
        tenant: tenantById.get(c.tenant_id) ?? null,
        unit: u,
        property: u ? (propById.get(u.property_id) ?? null) : null,
        charges: [],
        total: 0,
        oldestDue: ch.due_date,
        days: 0,
        bucket: "1~30일",
      };
      arrearsMap.set(c.id, item);
    }
    const days = daysBetween(ch.due_date, today);
    item.charges.push({ charge: ch, unpaid: unpaidOf(ch), days });
    item.total += unpaidOf(ch);
  }
  const arrears = [...arrearsMap.values()]
    .map((a) => {
      const days = daysBetween(a.oldestDue, today);
      return { ...a, days, bucket: agingBucket(days) };
    })
    .sort((a, b) => b.days - a.days || b.total - a.total);

  // 계약 만료 예정 -----------------------------------------------------------
  const maxAlert = Math.max(90, ...settings.expiryAlertDays);
  const expiring: ExpiringItem[] = [];
  for (const c of contracts) {
    if (c.status !== "active" || c.start_date > today) continue;
    const daysLeft = daysBetween(today, c.end_date);
    if (daysLeft < 0 || daysLeft > maxAlert) continue;
    // 이미 다음 계약(갱신)이 잡혀 있으면 제외
    const next = (contractsByUnit.get(c.unit_id) ?? []).find((x) => x.id !== c.id && x.start_date > c.end_date && x.status !== "terminated");
    if (next) continue;
    const u = unitById.get(c.unit_id) ?? null;
    expiring.push({
      contract: c,
      tenant: tenantById.get(c.tenant_id) ?? null,
      unit: u,
      property: u ? (propById.get(u.property_id) ?? null) : null,
      daysLeft,
      level: expiryLevel(daysLeft) ?? "yellow",
    });
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  // 보증금 반환 예정 ----------------------------------------------------------
  const depositsDue: Snapshot["depositsDue"] = [];
  for (const c of contracts) {
    if (c.status === "planned" || c.status === "renewed") continue;
    const d = depositByContract.get(c.id) ?? null;
    const amount = d ? d.received_amount || d.amount : c.deposit;
    const outstanding = amount - (d?.returned_amount ?? 0) - (d?.offset_amount ?? 0);
    if (outstanding <= 0 || d?.status === "returned") continue;
    const dueDate = d?.return_due_date ?? effectiveEnd(c);
    const daysLeft = daysBetween(today, dueDate);
    if (daysLeft > settings.depositAlertDays) continue;
    // 같은 호실에 갱신 계약이 이어지면 반환하지 않음
    const renewed = contracts.some((x) => x.previous_contract_id === c.id);
    if (renewed) continue;
    const u = unitById.get(c.unit_id) ?? null;
    depositsDue.push({
      contract: c,
      deposit: d,
      tenant: tenantById.get(c.tenant_id) ?? null,
      unit: u,
      property: u ? (propById.get(u.property_id) ?? null) : null,
      dueDate,
      daysLeft,
      outstanding,
    });
  }
  depositsDue.sort((a, b) => a.daysLeft - b.daysLeft);

  // 대출 만기 -------------------------------------------------------------
  const loansDue = loans
    .filter((l) => l.maturity_date && daysBetween(today, l.maturity_date) <= settings.loanMaturityAlertDays)
    .map((l) => ({ loan: l, property: propById.get(l.property_id) ?? null, daysLeft: daysBetween(today, l.maturity_date!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // 오늘 ------------------------------------------------------------------
  const dueCharges = charges
    .filter((c) => c.due_date === today && unpaidOf(c) > 0)
    .map((ch) => {
      const c = contractById.get(ch.contract_id)!;
      const u = unitById.get(c.unit_id) ?? null;
      return {
        charge: ch,
        contract: c,
        tenant: tenantById.get(c.tenant_id) ?? null,
        unit: u,
        property: u ? (propById.get(u.property_id) ?? null) : null,
        unpaid: unpaidOf(ch),
      };
    });
  const receivedPayments = payments.filter((p) => p.paid_date === today);

  // 월별 추이 -------------------------------------------------------------
  const monthsBack = opts.monthsBack ?? 12;
  const allocByCharge = new Map<string, { date: ISODate; amount: number }[]>();
  for (const a of ds.allocations) {
    const p = paymentById.get(a.payment_id);
    if (!p) continue;
    const arr = allocByCharge.get(a.charge_id) ?? [];
    arr.push({ date: p.paid_date, amount: a.amount });
    allocByCharge.set(a.charge_id, arr);
  }
  const monthly: MonthPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = addMonths(month, -i);
    const mEnd = monthEnd(m);
    const cutoff = mEnd < today ? mEnd : today;
    const billed = sum(charges.filter((c) => c.billing_month === m), (c) => c.amount);
    const collected = sum(payments.filter((p) => p.paid_date >= m && p.paid_date <= mEnd && p.method !== "offset"), (p) => p.amount);
    const mExp = expenses.filter((e) => e.expense_date >= m && e.expense_date <= mEnd);
    const interest = sum(mExp.filter((e) => e.category === "loan_interest"), (e) => e.amount);
    const exp = sum(mExp, (e) => e.amount) - interest;
    const outstanding = sum(
      charges.filter((c) => (cutoff === today ? c.due_date < today : c.due_date <= cutoff)),
      (c) => c.amount - sum((allocByCharge.get(c.id) ?? []).filter((x) => x.date <= cutoff), (x) => x.amount),
    );
    const loanBalance = sum(
      allLoans.filter((l) => !l.start_date || l.start_date <= mEnd),
      (l) => l.balance + sum(loanTxs.filter((t) => t.loan_id === l.id && t.tx_type === "principal" && t.tx_date > cutoff), (t) => t.amount),
    );
    const occ = units.filter((u) => (contractsByUnit.get(u.id) ?? []).some((c) => occupiesOn(c, cutoff))).length;
    monthly.push({
      month: m,
      billed,
      collected,
      expenses: exp,
      interest,
      net: collected - exp - interest,
      outstanding: Math.max(0, outstanding),
      loanBalance,
      vacancyRate: units.length ? ((units.length - occ) / units.length) * 100 : 0,
    });
  }

  // 합계 ------------------------------------------------------------------
  const pm = propertyMetrics;
  const totalMonthlyRent = sum(pm, (x) => x.monthlyRent);
  const totalOther = sum(pm, (x) => x.otherIncome);
  const totalInterest = sum(pm, (x) => x.monthlyInterest);
  // 부동산을 지정하지 않은 공통 비용 (법인 세무비 등) 도 전체 운영비에 포함
  const commonOpex = Math.round(
    sum(
      expenses.filter((e) => !e.property_id && e.category !== "loan_interest" && e.expense_date >= opexFrom && e.expense_date < month),
      (e) => e.amount,
    ) / opexMonths,
  );
  const totalOpex = sum(pm, (x) => x.monthlyOpex) + commonOpex;
  const totalNet = sum(pm, (x) => x.monthlyNet) - commonOpex;
  const totalEquity = sum(pm, (x) => x.equity);
  const purchaseTotal = sum(pm, (x) => x.property.purchase_price);
  const monthCharges = charges.filter((c) => c.billing_month === month);
  const credit = (() => {
    // 계약별 (입금 합계 - 배분 합계)
    const allocated = sum(ds.allocations.filter((a) => paymentById.has(a.payment_id)), (a) => a.amount);
    return Math.max(0, sum(payments, (p) => p.amount) - allocated);
  })();

  return {
    today,
    month,
    settings,
    owners: ds.owners,
    properties: pm,
    units: unitViews,
    arrears,
    expiring,
    depositsDue,
    loansDue,
    monthly,
    today_: { dueCharges, receivedPayments },
    totals: {
      propertyCount: pm.length,
      unitCount: unitViews.length,
      occupiedUnits: unitViews.filter((v) => v.occupied).length,
      vacantUnits: unitViews.filter((v) => !v.occupied).length,
      leasedProperties: pm.filter((x) => x.occupiedCount > 0).length,
      vacantProperties: pm.filter((x) => x.unitCount > 0 && x.occupiedCount === 0).length,
      deposits: sum(pm, (x) => x.deposits),
      monthlyRent: totalMonthlyRent,
      otherIncome: totalOther,
      monthBilled: sum(monthCharges, (c) => c.amount),
      monthCollected: sum(payments.filter((p) => p.paid_date >= month && p.paid_date <= today), (p) => p.amount),
      monthOutstanding: sum(monthCharges, unpaidOf),
      unpaid: sum(arrears, (a) => a.total),
      loanBalance: sum(pm, (x) => x.loanBalance),
      monthlyInterest: totalInterest,
      monthlyOpex: totalOpex,
      commonOpex,
      monthlyNet: totalNet,
      annualNet: sum(pm, (x) => x.annualNet) - commonOpex * 12,
      annualNetBeforeInterest: sum(pm, (x) => x.annualNet) - commonOpex * 12 + totalInterest * 12,
      equity: totalEquity,
      purchaseTotal,
      simpleYield: purchaseTotal > 0 ? (((totalMonthlyRent + totalOther) * 12) / purchaseTotal) * 100 : null,
      leveragedYield:
        totalEquity > 0 ? (((totalMonthlyRent + totalOther - totalInterest - totalOpex) * 12) / totalEquity) * 100 : null,
      vacancyRate: unitViews.length ? (unitViews.filter((v) => !v.occupied).length / unitViews.length) * 100 : 0,
      vacancyLossMonthly: sum(pm, (x) => x.vacancyLossMonthly),
      todayDue: sum(dueCharges, (x) => x.unpaid),
      todayDueCount: dueCharges.length,
      todayReceived: sum(receivedPayments, (p) => p.amount),
      credit,
    },
  };
}

// ---------------------------------------------------------------------------
// 소유주(개인/법인)별 묶음
// ---------------------------------------------------------------------------

export type OwnerSummary = {
  owner: Owner | null;
  propertyCount: number;
  unitCount: number;
  vacantUnits: number;
  monthlyRent: number;
  deposits: number;
  loanBalance: number;
  monthlyInterest: number;
  monthlyOpex: number;
  monthlyNet: number;
  annualNet: number;
  equity: number;
  unpaid: number;
  leveragedYield: number | null;
};

export function summarizeByOwner(s: Snapshot): OwnerSummary[] {
  const groups = new Map<string, PropertyMetrics[]>();
  for (const p of s.properties) {
    const k = p.property.owner_id ?? "";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()].map(([k, ps]) => {
    const equity = sum(ps, (x) => x.equity);
    const rent = sum(ps, (x) => x.monthlyRent + x.otherIncome);
    const interest = sum(ps, (x) => x.monthlyInterest);
    const opex = sum(ps, (x) => x.monthlyOpex);
    return {
      owner: s.owners.find((o) => o.id === k) ?? null,
      propertyCount: ps.length,
      unitCount: sum(ps, (x) => x.unitCount),
      vacantUnits: sum(ps, (x) => x.vacantCount),
      monthlyRent: sum(ps, (x) => x.monthlyRent),
      deposits: sum(ps, (x) => x.deposits),
      loanBalance: sum(ps, (x) => x.loanBalance),
      monthlyInterest: interest,
      monthlyOpex: opex,
      monthlyNet: sum(ps, (x) => x.monthlyNet),
      annualNet: sum(ps, (x) => x.annualNet),
      equity,
      unpaid: sum(ps, (x) => x.unpaid),
      leveragedYield: equity > 0 ? (((rent - interest - opex) * 12) / equity) * 100 : null,
    };
  });
}

// ---------------------------------------------------------------------------
// 시뮬레이션: 월세 인상, 금리 변경, 비용 변경, 공실
// ---------------------------------------------------------------------------

export type SimInput = {
  rentChangePct: number; // 월세 +5 → 5% 인상
  rateChangePt: number; // 금리 +1 → 1%p 인상
  opexChangePct: number;
  extraVacancyPct: number; // 추가 공실률 (월세 수입 감소율)
};

export type SimResult = {
  base: SimLine;
  scenario: SimLine;
  delta: SimLine;
};

export type SimLine = {
  monthlyRent: number;
  annualRent: number;
  annualInterest: number;
  annualOpex: number;
  annualNet: number;
  leveragedYield: number | null;
};

export function simulate(props: PropertyMetrics[], loans: Loan[], input: SimInput, settings: CalcSettings): SimResult {
  const propIds = new Set(props.map((p) => p.property.id));
  const activeLoans = loans.filter((l) => !l.is_closed && propIds.has(l.property_id));
  const equity = sum(props, (p) => p.equity);
  const line = (rentMul: number, ratePt: number, opexMul: number): SimLine => {
    const monthlyRent = Math.round(sum(props, (p) => p.monthlyRent) * rentMul);
    const other = sum(props, (p) => p.otherIncome);
    const annualRent = (monthlyRent + other) * 12;
    const annualInterest =
      sum(activeLoans, (l) => monthlyInterest(l.balance, Math.max(0, l.interest_rate + ratePt), settings.interestMethod)) * 12;
    const annualOpex = Math.round(sum(props, (p) => p.monthlyOpex) * opexMul) * 12;
    const annualNet = annualRent - annualInterest - annualOpex;
    return {
      monthlyRent,
      annualRent,
      annualInterest,
      annualOpex,
      annualNet,
      leveragedYield: equity > 0 ? (annualNet / equity) * 100 : null,
    };
  };
  const base = line(1, 0, 1);
  const scenario = line(
    (1 + input.rentChangePct / 100) * (1 - input.extraVacancyPct / 100),
    input.rateChangePt,
    1 + input.opexChangePct / 100,
  );
  const d = (a: number | null, b: number | null) => (a == null || b == null ? null : b - a);
  return {
    base,
    scenario,
    delta: {
      monthlyRent: scenario.monthlyRent - base.monthlyRent,
      annualRent: scenario.annualRent - base.annualRent,
      annualInterest: scenario.annualInterest - base.annualInterest,
      annualOpex: scenario.annualOpex - base.annualOpex,
      annualNet: scenario.annualNet - base.annualNet,
      leveragedYield: d(base.leveragedYield, scenario.leveragedYield),
    },
  };
}

// ---------------------------------------------------------------------------
// 투자 의사결정 (신규 매입 검토)
// ---------------------------------------------------------------------------

export type InvestInput = {
  price: number;
  deposit: number;
  monthlyRent: number;
  loanAmount: number;
  loanRate: number;
  acquisitionCost: number;
  monthlyMaintenance: number; // 예상 관리비(비용)
  annualTax: number; // 예상 세금 (재산세 등, 연)
  vacancyPct?: number; // 예상 공실률
};

export type InvestResult = {
  equityRequired: number;
  monthlyInterest: number;
  monthlyCost: number;
  monthlyCashflow: number;
  annualNet: number;
  grossYield: number | null; // 임대수익률 (연 월세 ÷ 매입가)
  netYield: number | null; // (연 순수익 + 연 이자) ÷ (매입가 + 취득비) : 대출 없을 때 수익률
  equityYield: number | null; // 자기자본 수익률
  interestBurden: number | null; // 월세 대비 이자 비율
  breakEvenRent: number; // 손익분기 월세
  breakEvenOccupancy: number | null; // 손익분기 임대율
  paybackYears: number | null; // 자기자본 회수기간
};

export function analyzeInvestment(i: InvestInput): InvestResult {
  const effRent = i.monthlyRent * (1 - (i.vacancyPct ?? 0) / 100);
  const equityRequired = i.price + i.acquisitionCost - i.loanAmount - i.deposit;
  const mInterest = monthlyInterest(i.loanAmount, i.loanRate);
  const monthlyCost = i.monthlyMaintenance + Math.round(i.annualTax / 12);
  const monthlyCashflow = Math.round(effRent - mInterest - monthlyCost);
  const annualNet = monthlyCashflow * 12;
  const breakEvenRent = mInterest + monthlyCost;
  return {
    equityRequired,
    monthlyInterest: mInterest,
    monthlyCost,
    monthlyCashflow,
    annualNet,
    grossYield: i.price > 0 ? ((i.monthlyRent * 12) / i.price) * 100 : null,
    netYield: i.price + i.acquisitionCost > 0 ? ((annualNet + mInterest * 12) / (i.price + i.acquisitionCost)) * 100 : null,
    equityYield: equityRequired > 0 ? (annualNet / equityRequired) * 100 : null,
    interestBurden: effRent > 0 ? (mInterest / effRent) * 100 : null,
    breakEvenRent,
    breakEvenOccupancy: i.monthlyRent > 0 ? (breakEvenRent / i.monthlyRent) * 100 : null,
    paybackYears: annualNet > 0 && equityRequired > 0 ? equityRequired / annualNet : null,
  };
}
