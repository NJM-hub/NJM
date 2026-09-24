import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { seed } from "../src/seed.js";
import * as repo from "../src/repo.js";
import { computePortfolio } from "../src/ledger.js";

const TODAY = "2026-09-24";

function fresh() {
  const db = openDb(":memory:");
  seed(db, TODAY);
  return db;
}

test("샘플 데이터: 모든 투자건의 회차 합계 = 총 회수예정금액", () => {
  const db = fresh();
  for (const it of repo.loadAll(db)) {
    const s = it.schedules.reduce((a, r) => a + r.amount, 0);
    assert.equal(s, it.inv.total_expected, it.inv.code);
  }
});

test("샘플 데이터: 요청한 상태 사례가 모두 존재", () => {
  const db = fresh();
  const rows = repo.computeAll(db, TODAY).map(repo.summaryRow);
  const statuses = new Set(rows.map((r) => r.status));
  for (const s of ["정상", "일부입금", "지연", "연체", "완납"]) assert.ok(statuses.has(s), s);
  assert.ok(rows.some((r) => r.flags.expiringSoon), "만료임박");
  assert.ok(rows.some((r) => r.termUnit === "week"), "주 단위 기간");
  const hong = rows.find((r) => r.customerName === "홍길동" && r.termValue === 100);
  const detail = repo.computeOne(db, hong.id, TODAY);
  assert.equal(detail.rows[2].status, "일부입금");
  assert.equal(detail.rows[2].paid, 80000);
  assert.equal(detail.rows[3].paid, 0);
});

test("포트폴리오: 회수 + 미회수 = 총 회수예정, 기준일에 따라 재계산", () => {
  const db = fresh();
  for (const d of ["2026-06-01", TODAY, "2026-10-01", "2027-06-01"]) {
    const items = repo.computeAll(db, d);
    const t = computePortfolio(items, d);
    assert.equal(t.collected + t.outstanding, t.totalExpected, d);
    assert.ok(t.unpaidInclOverdue >= t.overdueAmount);
  }
  const now = computePortfolio(repo.computeAll(db, TODAY), TODAY);
  const later = computePortfolio(repo.computeAll(db, "2026-10-01"), "2026-10-01");
  assert.ok(later.unpaidInclOverdue > now.unpaidInclOverdue, "미래 기준일에는 미수금 증가");
});

test("입금·수정 즉시 반영 + 수정 이력", () => {
  const db = fresh();
  const [first] = repo.computeAll(db, TODAY).filter((it) => it.calc.outstanding > 0 && it.calc.started);
  const id = first.inv.investment_id;
  const before = repo.computeOne(db, id, TODAY).collected;
  const pid = repo.addPayment(db, id, { amount: 50000, paidDate: TODAY }, "t");
  assert.equal(repo.computeOne(db, id, TODAY).collected, before + 50000);
  repo.updatePayment(db, pid, { amount: 70000, paidDate: TODAY }, "t");
  assert.equal(repo.computeOne(db, id, TODAY).collected, before + 70000);
  repo.deletePayment(db, pid, "t");
  assert.equal(repo.computeOne(db, id, TODAY).collected, before);
  const log = db.prepare("SELECT action FROM audit_log WHERE entity = 'payment' AND entity_id = ?").all(pid).map((r) => r.action);
  assert.deepEqual(log, ["create", "update", "delete"]);
});

test("조건 변경 시 스케줄 재생성, 입금 기록은 유지", () => {
  const db = fresh();
  const id = repo.createInvestment(db, { customerName: "A", companyName: "B", execDate: "2026-09-01", principal: 10000000, rate: "20", termValue: 100, termUnit: "day", cycleValue: 1, cycleUnit: "day", method: "equal_total" }, "t");
  repo.addPayment(db, id, { amount: 120000, paidDate: "2026-09-01", seq: 1 }, "t");
  repo.addPayment(db, id, { amount: 120000, paidDate: "2026-09-02", seq: 90 }, "t");
  const r = repo.updateInvestment(db, id, { termValue: 12, termUnit: "week", cycleValue: 1, cycleUnit: "week" }, "t");
  assert.equal(r.regenerated, true);
  const c = repo.computeOne(db, id, "2026-09-02");
  assert.equal(c.installments, 12);
  assert.equal(c.collected, 240000);
  assert.equal(db.prepare("SELECT seq FROM payments WHERE investment_id = ? ORDER BY payment_id").all(id)[1].seq, null);
});

test("회차 금액 수정: 마지막 회차 조정으로 총액 유지", () => {
  const db = fresh();
  const id = repo.createInvestment(db, { customerName: "A", companyName: "B", execDate: "2026-09-01", principal: 1000000, rate: "10", termValue: 10, termUnit: "day", cycleValue: 1, cycleUnit: "day", method: "equal_total" }, "t");
  repo.updateScheduleAmount(db, id, 1, 150000, true, "t");
  const rows = db.prepare("SELECT amount FROM schedules WHERE investment_id = ? ORDER BY seq").all(id).map((r) => r.amount);
  assert.equal(rows[0], 150000);
  assert.equal(rows[9], 110000 - 40000);
  assert.equal(rows.reduce((a, b) => a + b, 0), 1100000);
});

test("배포 초기화: 환경변수 관리자 생성 + 샘플은 비어 있을 때만", async () => {
  const { bootstrap } = await import("../server.js");
  const db = openDb(":memory:");
  const env = { ADMIN_PASSWORD: "testpass123", SEED_SAMPLE: "1" };
  bootstrap(db, env);
  bootstrap(db, env);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
  const n = db.prepare("SELECT COUNT(*) AS n FROM investments").get().n;
  assert.ok(n > 0);
  bootstrap(db, env);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM investments").get().n, n);
  assert.throws(() => bootstrap(openDb(":memory:"), { ADMIN_PASSWORD: "short" }));
});
