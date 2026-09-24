import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "../src/schedule.js";
import { calcProfit, splitEven } from "../src/money.js";
import { addMonths, weekEnd } from "../src/dates.js";
import { computeInvestment } from "../src/ledger.js";

const base = { principal: 10000000, rate: "20", execDate: "2026-09-01", method: "equal_total" };
const total = (p) => p.installments.reduce((a, r) => a + r.amount, 0);

test("수익 계산은 원 단위 정수로 정확", () => {
  assert.equal(calcProfit(10000000, "20"), 2000000);
  assert.equal(calcProfit(12345679, "13.3"), 1641975); // 1641975.307 → 반올림
  assert.equal(calcProfit(1000, "0.05"), 1); // 0.5 → 1 (반올림)
  assert.equal(calcProfit(999999999999, "33.3333"), 333333000000);
});

test("균등분할 나머지는 마지막 회차에서 조정", () => {
  const a = splitEven(10000000, 3);
  assert.deepEqual(a, [3333333, 3333333, 3333334]);
});

test("100일 매일 상환: 120,000원 × 100회, 만료일 12-09", () => {
  const p = buildPlan({ ...base, termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  assert.ok(p.ok, p.errors);
  assert.equal(p.totalExpected, 12000000);
  assert.equal(p.count, 100);
  assert.equal(p.perAmount, 120000);
  assert.equal(p.installments[0].dueDate, "2026-09-01");
  assert.equal(p.installments[3].dueDate, "2026-09-04");
  assert.equal(p.expiryDate, "2026-12-09");
  assert.equal(total(p), 12000000);
});

test("120일 10일마다: 09-01, 09-11, 09-21, 10-01 … 12회", () => {
  const p = buildPlan({ ...base, termValue: 120, termUnit: "day", cycleValue: 10, cycleUnit: "day" });
  assert.equal(p.count, 12);
  assert.deepEqual(
    p.installments.slice(0, 4).map((r) => r.dueDate),
    ["2026-09-01", "2026-09-11", "2026-09-21", "2026-10-01"],
  );
  assert.equal(p.perAmount, 1000000);
  assert.equal(total(p), 12000000);
});

test("6개월 매월 상환: 09-01, 10-01, 11-01 …", () => {
  const p = buildPlan({ ...base, termValue: 6, termUnit: "month", cycleValue: 1, cycleUnit: "month" });
  assert.equal(p.count, 6);
  assert.deepEqual(
    p.installments.map((r) => r.dueDate),
    ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"],
  );
  assert.equal(p.perAmount, 2000000);
});

test("주 단위 기간: 12주 매주 상환 → 12회, 84일", () => {
  const p = buildPlan({ ...base, termValue: 12, termUnit: "week", cycleValue: 1, cycleUnit: "week" });
  assert.ok(p.ok, p.errors);
  assert.equal(p.count, 12);
  assert.equal(p.termDays, 84);
  assert.equal(p.installments[1].dueDate, "2026-09-08");
  assert.equal(p.expiryDate, "2026-11-23");
  assert.equal(p.perAmount, 1000000);
});

test("주 단위 기간 + 2주마다 / 매일 상환 혼합", () => {
  const a = buildPlan({ ...base, termValue: 8, termUnit: "week", cycleValue: 2, cycleUnit: "week" });
  assert.equal(a.count, 4);
  assert.equal(a.installments[1].dueDate, "2026-09-15");
  const b = buildPlan({ ...base, termValue: 4, termUnit: "week", cycleValue: 1, cycleUnit: "day" });
  assert.equal(b.count, 28);
  assert.equal(total(b), 12000000);
  assert.equal(b.lastAmount, 12000000 - Math.floor(12000000 / 28) * 27);
});

test("나누어 떨어지지 않으면 마지막 회차 조정, 합계 정확", () => {
  const p = buildPlan({ ...base, principal: 7777777, rate: "17.7", termValue: 60, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  assert.equal(total(p), p.totalExpected);
  assert.equal(p.totalExpected, 7777777 + 1376667);
});

test("회수방식별 합계 일치", () => {
  for (const method of ["equal_total", "equal_principal", "equal_profit", "bullet", "manual"]) {
    const p = buildPlan({ ...base, principal: 9876543, rate: "21.37", method, termValue: 100, termUnit: "day", cycleValue: 7, cycleUnit: "day" });
    assert.ok(p.ok, method);
    assert.equal(total(p), p.totalExpected, method);
  }
  const bullet = buildPlan({ ...base, method: "bullet", termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  assert.equal(bullet.count, 1);
  assert.equal(bullet.installments[0].dueDate, "2026-12-09");
  const ep = buildPlan({ ...base, method: "equal_profit", termValue: 4, termUnit: "month", cycleValue: 1, cycleUnit: "month" });
  assert.deepEqual(ep.installments.map((r) => r.amount), [500000, 500000, 500000, 10500000]);
});

test("1회 회수금액 직접 입력 시 마지막 회차가 잔액", () => {
  const p = buildPlan({ ...base, installmentAmount: 115000, termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  assert.equal(p.perAmount, 115000);
  assert.equal(p.lastAmount, 12000000 - 115000 * 99);
  const bad = buildPlan({ ...base, installmentAmount: 130000, termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  assert.equal(bad.ok, false);
});

test("월말 처리", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(weekEnd("2026-09-24"), "2026-09-27");
});

test("부분입금·지연·연체 상태", () => {
  const p = buildPlan({ ...base, termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day" });
  const inv = { id: 1, code: "T", exec_date: "2026-09-01", expiry_date: p.expiryDate, principal: p.principal, total_expected: p.totalExpected };
  const sch = p.installments.map((r) => ({ seq: r.seq, due_date: r.dueDate, amount: r.amount }));
  const pays = [
    { id: 1, seq: 1, paid_date: "2026-09-01", amount: 120000 },
    { id: 2, seq: 2, paid_date: "2026-09-02", amount: 120000 },
    { id: 3, seq: 3, paid_date: "2026-09-03", amount: 80000 },
  ];
  const c = computeInvestment(inv, sch, pays, "2026-09-05");
  assert.equal(c.rows[2].status, "일부입금");
  assert.equal(c.rows[2].shortfall, 40000);
  assert.equal(c.rows[3].status, "지연");
  assert.equal(c.rows[3].delayDays, 1);
  assert.equal(c.rows[4].status, "오늘");
  assert.equal(c.collected, 320000);
  assert.equal(c.outstanding, 12000000 - 320000);
  assert.equal(c.status, "일부입금");
  assert.equal(c.overdueAmount, 40000 + 120000);
  assert.equal(c.elapsedDays, 5);
  assert.equal(c.remainingDays, 95);

  const later = computeInvestment(inv, sch, pays, "2026-09-20");
  assert.equal(later.status, "연체");
  assert.equal(later.rows[3].status, "연체");
  assert.equal(later.maxDelay, 17);

  // 기준일 이전으로 돌리면 이후 입금은 반영되지 않음
  const earlier = computeInvestment(inv, sch, pays, "2026-09-02");
  assert.equal(earlier.collected, 240000);
  assert.equal(earlier.status, "정상");

  // 회차 미지정 일괄입금은 가장 오래된 미수 회차부터 충당
  const lump = computeInvestment(inv, sch, [...pays, { id: 4, seq: null, paid_date: "2026-09-05", amount: 200000 }], "2026-09-05");
  assert.equal(lump.rows[2].shortfall, 0);
  assert.equal(lump.rows[3].paid, 120000);
  assert.equal(lump.rows[4].paid, 40000);
});

test("전액 회수 시 완납", () => {
  const p = buildPlan({ ...base, termValue: 2, termUnit: "month", cycleValue: 1, cycleUnit: "month" });
  const inv = { id: 1, code: "T", exec_date: "2026-09-01", expiry_date: p.expiryDate, principal: p.principal, total_expected: p.totalExpected };
  const sch = p.installments.map((r) => ({ seq: r.seq, due_date: r.dueDate, amount: r.amount }));
  const c = computeInvestment(inv, sch, [{ id: 1, seq: null, paid_date: "2026-09-10", amount: 12000000 }], "2026-09-10");
  assert.equal(c.status, "완납");
  assert.equal(c.outstanding, 0);
  assert.equal(c.progressPct, 100);
});
