import { describe, expect, it } from "vitest";
import { DEFAULT_CALC } from "@/lib/calcSettings";
import {
  agingBucket,
  allocate,
  analyzeInvestment,
  buildSnapshot,
  chargeState,
  effectiveStatus,
  expiryLevel,
  monthlyInterest,
  planCharges,
  simulate,
} from "@/lib/engine";
import type { Charge, Contract, Dataset, Loan, Property, Unit } from "@/lib/types";

const contract = (o: Partial<Contract> = {}): Contract => ({
  id: "c1",
  contract_no: "C-1",
  unit_id: "u1",
  tenant_id: "t1",
  landlord_name: null,
  contract_date: null,
  start_date: "2026-01-01",
  end_date: "2027-12-31",
  deposit: 50_000_000,
  monthly_rent: 2_000_000,
  maintenance_fee: 0,
  vat_amount: 0,
  pay_day: 25,
  billing_from: null,
  status: "active",
  is_renewal: false,
  previous_contract_id: null,
  terminated_on: null,
  special_terms: null,
  memo: null,
  ...o,
});

const property = (o: Partial<Property> = {}): Property => ({
  id: "p1",
  owner_id: null,
  name: "강남 OO빌딩",
  address: null,
  building_name: null,
  property_type: "commercial",
  purchase_date: "2024-01-01",
  purchase_price: 6_500_000_000,
  current_value: null,
  acquisition_cost: 0,
  remodeling_cost: 0,
  other_investment: 0,
  memo: null,
  is_active: true,
  ...o,
});

const unit = (o: Partial<Unit> = {}): Unit => ({
  id: "u1",
  property_id: "p1",
  dong: null,
  floor: null,
  unit_no: "302호",
  area_m2: null,
  expected_deposit: 0,
  expected_rent: 0,
  vacant_since: null,
  memo: null,
  is_active: true,
  ...o,
});

const loan = (o: Partial<Loan> = {}): Loan => ({
  id: "l1",
  property_id: "p1",
  lender: "OO은행",
  product: null,
  start_date: "2024-01-01",
  principal: 3_500_000_000,
  balance: 3_500_000_000,
  interest_rate: 144 / 35, // 월 이자 12,000,000원이 나오도록 (약 4.11%)
  rate_type: "variable",
  repayment_type: "bullet",
  monthly_payment: null,
  interest_day: 20,
  maturity_date: "2029-01-01",
  memo: null,
  is_closed: false,
  ...o,
});

const empty = (): Dataset => ({
  owners: [],
  properties: [],
  units: [],
  tenants: [],
  contracts: [],
  deposits: [],
  charges: [],
  payments: [],
  allocations: [],
  loans: [],
  loanTxs: [],
  expenses: [],
});

describe("대출이자", () => {
  it("대출잔액 10억, 금리 5% → 월 4,166,667원 (연 5,000만원)", () => {
    expect(monthlyInterest(1_000_000_000, 5)).toBe(4_166_667);
    expect(monthlyInterest(1_000_000_000, 5) * 12).toBeCloseTo(50_000_000, -2);
  });
  it("일할 계산: 31일인 달", () => {
    expect(monthlyInterest(1_000_000_000, 5, "daily", "2026-10-01")).toBe(Math.round((1e9 * 0.05 * 31) / 365));
  });
});

describe("월세 자동 청구", () => {
  it("매월 25일 납부 → 시작월부터 이번 달까지 청구", () => {
    const list = planCharges(contract({ start_date: "2026-07-10" }), "2026-10-02");
    expect(list.map((c) => c.due_date)).toEqual(["2026-07-25", "2026-08-25", "2026-09-25", "2026-10-25"]);
    expect(list[0].amount).toBe(2_000_000);
  });
  it("31일 납부는 말일로", () => {
    const list = planCharges(contract({ start_date: "2026-02-01", pay_day: 31 }), "2026-04-01");
    expect(list.map((c) => c.due_date)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("청구 시작 월을 지정하면 그 전 달은 만들지 않음", () => {
    const list = planCharges(contract({ start_date: "2024-01-01", billing_from: "2026-09-01" }), "2026-10-02");
    expect(list.map((c) => c.billing_month)).toEqual(["2026-09-01", "2026-10-01"]);
  });
  it("계약 예정(시작 전)은 청구 없음, 종료된 계약은 종료월까지", () => {
    expect(planCharges(contract({ status: "planned", start_date: "2026-11-01" }), "2026-10-02")).toEqual([]);
    const ended = planCharges(contract({ start_date: "2026-01-01", end_date: "2026-03-31", status: "expired" }), "2026-10-02");
    expect(ended).toHaveLength(3);
  });
  it("관리비·부가세 포함 청구 합계", () => {
    const [c] = planCharges(contract({ start_date: "2026-10-01", maintenance_fee: 150_000, vat_amount: 200_000 }), "2026-10-02");
    expect(c.amount).toBe(2_350_000);
  });
});

describe("입금 배분 / 미납", () => {
  const charges = ["01", "02", "03", "04"].map((m) => ({
    id: m,
    billing_month: `2026-${m}-01`,
    due_date: `2026-${m}-25`,
    amount: 2_000_000,
  }));
  const pay = (id: string, date: string, amount: number, charge_id: string | null = null) => ({
    id,
    paid_date: date,
    amount,
    charge_id,
    created_at: date,
  });

  it("예시 표: 1·2월 완납, 3월 일부, 4월 미입금 → 총 미납 3,000,000원", () => {
    const r = allocate([pay("a", "2026-01-25", 2_000_000), pay("b", "2026-02-25", 2_000_000), pay("c", "2026-03-25", 1_000_000)], charges);
    expect([...r.paid.values()]).toEqual([2_000_000, 2_000_000, 1_000_000, 0]);
    const unpaid = charges.reduce((s, c) => s + c.amount - (r.paid.get(c.id) ?? 0), 0);
    expect(unpaid).toBe(3_000_000);
    expect(r.credit).toBe(0);
  });
  it("입금하면 가장 오래된 미납부터 자동 차감", () => {
    const r = allocate([pay("a", "2026-05-01", 3_000_000)], charges);
    expect(r.paid.get("01")).toBe(2_000_000);
    expect(r.paid.get("02")).toBe(1_000_000);
  });
  it("청구월을 지정하면 그 달 먼저, 초과분은 선납", () => {
    const r = allocate([pay("a", "2026-05-01", 9_000_000, "04")], charges);
    expect(r.paid.get("04")).toBe(2_000_000);
    expect(r.paid.get("01")).toBe(2_000_000);
    expect(r.credit).toBe(1_000_000);
  });
  it("여러 달 치를 한 번에 입금했는데 중간 달이 실제 미납: 그 달을 미납으로 고정하면 건너뛰고 다음 달을 채움", () => {
    const held = charges.map((c) => (c.id === "02" ? { ...c, hold_unpaid: true } : c));
    const r = allocate([pay("a", "2026-05-01", 6_000_000)], held);
    expect(r.paid.get("01")).toBe(2_000_000);
    expect(r.paid.get("02")).toBe(0);
    expect(r.paid.get("03")).toBe(2_000_000);
    expect(r.paid.get("04")).toBe(2_000_000);
    // 그 달을 지정한 입금은 채운다
    const r2 = allocate([pay("b", "2026-06-01", 2_000_000, "02")], held);
    expect(r2.paid.get("02")).toBe(2_000_000);
  });
  it("청구 상태와 미납 기간 구분", () => {
    expect(chargeState({ amount: 100, paid_amount: 100, due_date: "2026-01-01" }, "2026-10-02")).toBe("paid");
    expect(chargeState({ amount: 100, paid_amount: 50, due_date: "2026-01-01" }, "2026-10-02")).toBe("overdue");
    expect(chargeState({ amount: 100, paid_amount: 0, due_date: "2026-10-25" }, "2026-10-02")).toBe("scheduled");
    expect(agingBucket(1)).toBe("1~30일");
    expect(agingBucket(31)).toBe("31~60일");
    expect(agingBucket(61)).toBe("61~90일");
    expect(agingBucket(91)).toBe("90일 이상");
  });
});

describe("계약 상태 / 만료 알림", () => {
  it("만료 예정 단계", () => {
    expect(expiryLevel(25)).toBe("red");
    expect(expiryLevel(45)).toBe("orange");
    expect(expiryLevel(80)).toBe("yellow");
    expect(expiryLevel(120)).toBeNull();
    expect(effectiveStatus(contract({ end_date: "2026-11-15" }), "2026-10-02")).toBe("expiring");
    expect(effectiveStatus(contract({ end_date: "2026-09-30" }), "2026-10-02")).toBe("expired");
    expect(effectiveStatus(contract({ start_date: "2026-12-01" }), "2026-10-02")).toBe("planned");
  });
});

describe("부동산별 손익 (명령서 13번 예시)", () => {
  it("강남 OO빌딩: 월세 1,800만 - 이자 1,200만 - 운영비 150만 = 월 450만, 연 5,400만, 자기자본 수익률 1.8%", () => {
    const ds = empty();
    ds.properties = [property()];
    ds.units = [unit()];
    ds.contracts = [contract({ monthly_rent: 18_000_000, deposit: 500_000_000 })];
    ds.loans = [loan()];
    // 지난 12개월 운영비 월 150만원
    for (let m = 1; m <= 12; m++) {
      const d = m <= 9 ? `2026-0${m}-10` : `2025-${m}-10`;
      ds.expenses.push({ id: `e${m}`, property_id: "p1", owner_id: null, expense_date: d, category: "repair", amount: 1_500_000, vendor: null, memo: null, loan_id: null });
    }
    // 예시는 보증금을 자기자본에서 빼지 않음 → 식을 바꿔서 확인 (설정에서 계산식 수정)
    const settings = {
      ...DEFAULT_CALC,
      formulas: { ...DEFAULT_CALC.formulas, equity: "매입가격 - 대출잔액" },
    };
    const s = buildSnapshot(ds, settings, "2026-10-02");
    const p = s.properties[0];
    expect(p.monthlyRent).toBe(18_000_000);
    expect(p.monthlyInterest).toBe(12_000_000);
    expect(p.monthlyOpex).toBe(1_500_000);
    expect(p.monthlyNet).toBe(4_500_000);
    expect(p.annualNet).toBe(54_000_000);
    expect(p.equity).toBe(3_000_000_000);
    expect(p.leveragedYield!.toFixed(1)).toBe("1.8");
    expect(p.simpleYield!.toFixed(2)).toBe(((18_000_000 * 12) / 6_500_000_000 * 100).toFixed(2));

    // 기본 식: 자기자본 = 매입 + 비용 - 대출 - 보증금
    const s2 = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    expect(s2.properties[0].equity).toBe(2_500_000_000);
  });
});

describe("공실", () => {
  it("강남빌딩 502호: 공실 42일, 월세 300만 → 공실손실 4,200,000원", () => {
    const ds = empty();
    ds.properties = [property()];
    ds.units = [unit({ id: "u502", unit_no: "502호", expected_rent: 3_000_000, vacant_since: "2026-08-21" })];
    const s = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    const v = s.units[0];
    expect(v.occupied).toBe(false);
    expect(v.vacancyDays).toBe(42);
    expect(v.vacancyLoss).toBe(4_200_000);
    expect(s.totals.vacancyRate).toBe(100);
    expect(s.totals.vacantProperties).toBe(1);
  });
  it("계약이 끝난 다음 날부터 공실", () => {
    const ds = empty();
    ds.properties = [property()];
    ds.units = [unit({ expected_rent: 3_000_000 })];
    ds.contracts = [contract({ start_date: "2025-01-01", end_date: "2026-09-30", status: "expired" })];
    const s = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    expect(s.units[0].vacancyStart).toBe("2026-10-01");
    expect(s.units[0].vacancyDays).toBe(1);
  });
});

describe("미납 현황 (대시보드)", () => {
  it("납부일 지난 미입금만 미납, 기간·합계 계산", () => {
    const ds = empty();
    ds.properties = [property()];
    ds.units = [unit()];
    ds.tenants = [{ id: "t1", name: "김OO", phone: null, biz_no: null, email: null, memo: null }];
    ds.contracts = [contract()];
    const ch = (m: string, paid: number): Charge => ({
      id: m,
      contract_id: "c1",
      billing_month: `2026-${m}-01`,
      due_date: `2026-${m}-25`,
      rent_amount: 2_000_000,
      maintenance_amount: 0,
      vat_amount: 0,
      amount: 2_000_000,
      paid_amount: paid,
      memo: null,
    });
    ds.charges = [ch("08", 2_000_000), ch("09", 0), ch("10", 0)];
    ds.charges[0].due_date = "2026-08-25";
    ds.charges.push({ ...ch("07", 0), id: "07" });
    const s = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    expect(s.arrears).toHaveLength(1);
    const a = s.arrears[0];
    expect(a.total).toBe(4_000_000); // 7월 + 9월 (10월은 아직 납부일 전)
    expect(a.oldestDue).toBe("2026-07-25");
    expect(a.days).toBe(69);
    expect(a.bucket).toBe("61~90일");
    expect(s.totals.monthOutstanding).toBe(2_000_000);
  });
});

describe("시뮬레이션", () => {
  it("월세 1,800만 → 5% 인상 → 1,890만, 연간 추가수익 1,080만원", () => {
    const ds = empty();
    ds.properties = [property()];
    ds.units = [unit()];
    ds.contracts = [contract({ monthly_rent: 18_000_000 })];
    const s = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    const r = simulate(s.properties, [], { rentChangePct: 5, rateChangePt: 0, opexChangePct: 0, extraVacancyPct: 0 }, DEFAULT_CALC);
    expect(r.scenario.monthlyRent).toBe(18_900_000);
    expect(r.delta.annualNet).toBe(10_800_000);
  });
  it("금리 5% → 6%: 10억 대출이면 연 이자 1,000만원 증가, 순수익 같은 만큼 감소", () => {
    const ds = empty();
    ds.properties = [property()];
    const l = loan({ balance: 1_000_000_000, interest_rate: 5 });
    ds.loans = [l];
    const s = buildSnapshot(ds, DEFAULT_CALC, "2026-10-02");
    const r = simulate(s.properties, [l], { rentChangePct: 0, rateChangePt: 1, opexChangePct: 0, extraVacancyPct: 0 }, DEFAULT_CALC);
    expect(r.delta.annualInterest).toBeCloseTo(10_000_000, -2);
    expect(r.delta.annualNet).toBe(-r.delta.annualInterest);
  });
});

describe("투자 의사결정", () => {
  it("매입 10억, 보증금 1억, 월세 500만, 대출 5억(5%), 취득비 5천만", () => {
    const r = analyzeInvestment({
      price: 1_000_000_000,
      deposit: 100_000_000,
      monthlyRent: 5_000_000,
      loanAmount: 500_000_000,
      loanRate: 5,
      acquisitionCost: 50_000_000,
      monthlyMaintenance: 300_000,
      annualTax: 2_400_000,
    });
    expect(r.equityRequired).toBe(450_000_000);
    expect(r.monthlyInterest).toBe(2_083_333);
    expect(r.monthlyCashflow).toBe(5_000_000 - 2_083_333 - 300_000 - 200_000);
    expect(r.annualNet).toBe(r.monthlyCashflow * 12);
    expect(r.grossYield).toBe(6);
    expect(r.breakEvenRent).toBe(2_583_333);
    expect(r.paybackYears!).toBeCloseTo(450_000_000 / r.annualNet, 5);
  });
});
