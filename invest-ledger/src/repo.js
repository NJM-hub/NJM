// 데이터 접근 + 업무 규칙 (등록/수정/입금/이력)
import { tx, getSettings } from "./db.js";
import { buildPlan, METHODS, termLabel, cycleLabel } from "./schedule.js";
import { computeInvestment } from "./ledger.js";
import { isDate } from "./dates.js";
import { toWon } from "./money.js";

export class UserError extends Error {
  constructor(msg, details) {
    super(msg);
    this.status = 400;
    this.details = details;
  }
}

const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);

export function audit(db, user, entity, entityId, investmentId, action, detail) {
  db.prepare("INSERT INTO audit_log(username, entity, entity_id, investment_id, action, detail) VALUES (?, ?, ?, ?, ?, ?)").run(
    user ?? "",
    entity,
    entityId ?? null,
    investmentId ?? null,
    action,
    typeof detail === "string" ? detail : JSON.stringify(detail ?? {}),
  );
}

// ---------- 고객 / 투자처 ----------
export function upsertCustomer(db, { customerId, name, phone, memo }, user) {
  if (customerId) {
    const c = db.prepare("SELECT * FROM customers WHERE customer_id = ?").get(customerId);
    if (!c) throw new UserError("고객을 찾을 수 없습니다.");
    return c.customer_id;
  }
  name = str(name, 100);
  if (!name) throw new UserError("고객명을 입력하세요.");
  phone = str(phone, 50);
  const existing = db
    .prepare("SELECT customer_id, phone FROM customers WHERE name = ? AND (phone = ? OR ? = '' OR phone = '') ORDER BY customer_id LIMIT 1")
    .get(name, phone, phone);
  if (existing) {
    if (phone && !existing.phone) db.prepare("UPDATE customers SET phone = ? WHERE customer_id = ?").run(phone, existing.customer_id);
    return existing.customer_id;
  }
  const r = db.prepare("INSERT INTO customers(name, phone, memo) VALUES (?, ?, ?)").run(name, phone, str(memo));
  audit(db, user, "customer", Number(r.lastInsertRowid), null, "create", { name, phone });
  return Number(r.lastInsertRowid);
}

export function upsertCompany(db, { companyId, name, manager, phone, memo }, user) {
  if (companyId) {
    const c = db.prepare("SELECT * FROM companies WHERE investment_company_id = ?").get(companyId);
    if (!c) throw new UserError("투자처를 찾을 수 없습니다.");
    return c.investment_company_id;
  }
  name = str(name, 100);
  if (!name) throw new UserError("투자처명을 입력하세요.");
  const existing = db.prepare("SELECT investment_company_id FROM companies WHERE name = ?").get(name);
  if (existing) return existing.investment_company_id;
  const r = db
    .prepare("INSERT INTO companies(name, manager, phone, memo) VALUES (?, ?, ?, ?)")
    .run(name, str(manager, 100), str(phone, 50), str(memo));
  audit(db, user, "company", Number(r.lastInsertRowid), null, "create", { name });
  return Number(r.lastInsertRowid);
}

export function updateCustomer(db, id, { name, phone, memo }, user) {
  const c = db.prepare("SELECT * FROM customers WHERE customer_id = ?").get(id);
  if (!c) throw new UserError("고객을 찾을 수 없습니다.");
  const next = { name: str(name, 100) || c.name, phone: str(phone, 50), memo: str(memo) };
  db.prepare("UPDATE customers SET name = ?, phone = ?, memo = ?, updated_at = datetime('now') WHERE customer_id = ?").run(
    next.name,
    next.phone,
    next.memo,
    id,
  );
  audit(db, user, "customer", id, null, "update", diff(c, next));
}

export function updateCompany(db, id, { name, manager, phone, memo }, user) {
  const c = db.prepare("SELECT * FROM companies WHERE investment_company_id = ?").get(id);
  if (!c) throw new UserError("투자처를 찾을 수 없습니다.");
  const next = { name: str(name, 100) || c.name, manager: str(manager, 100), phone: str(phone, 50), memo: str(memo) };
  db.prepare(
    "UPDATE companies SET name = ?, manager = ?, phone = ?, memo = ?, updated_at = datetime('now') WHERE investment_company_id = ?",
  ).run(next.name, next.manager, next.phone, next.memo, id);
  audit(db, user, "company", id, null, "update", diff(c, next));
}

function diff(before, after) {
  const out = {};
  for (const k of Object.keys(after)) if (before[k] !== after[k]) out[k] = [before[k], after[k]];
  return out;
}

// ---------- 투자 ----------
function nextCode(db, execDate) {
  const ym = execDate.slice(0, 7).replace("-", "");
  const prefix = `INV-${ym}-`;
  const row = db.prepare("SELECT code FROM investments WHERE code LIKE ? ORDER BY code DESC LIMIT 1").get(prefix + "%");
  const n = row ? Number(row.code.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(3, "0");
}

function planOrThrow(input) {
  const plan = buildPlan(input);
  if (!plan.ok) throw new UserError(plan.errors[0], plan.errors);
  return plan;
}

function insertSchedules(db, id, plan) {
  const st = db.prepare("INSERT INTO schedules(investment_id, seq, due_date, amount) VALUES (?, ?, ?, ?)");
  for (const r of plan.installments) st.run(id, r.seq, r.dueDate, r.amount);
}

export function createInvestment(db, input, user) {
  const plan = planOrThrow(input);
  return tx(db, () => {
    const customerId = upsertCustomer(db, { customerId: input.customerId, name: input.customerName, phone: input.customerPhone }, user);
    const companyId = upsertCompany(
      db,
      { companyId: input.companyId, name: input.companyName, manager: input.manager, phone: input.contact },
      user,
    );
    const t = plan.terms;
    const code = nextCode(db, t.execDate);
    const r = db
      .prepare(
        `INSERT INTO investments(code, customer_id, company_id, manager, contact, category, memo, exec_date, principal, rate,
          total_expected, total_override, term_value, term_unit, term_days, cycle_value, cycle_unit, method, first_due_date,
          installment_amount, expiry_date, expiry_override)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        code,
        customerId,
        companyId,
        str(input.manager, 100),
        str(input.contact, 50),
        str(input.category, 50),
        str(input.memo, 2000),
        t.execDate,
        plan.principal,
        plan.rate,
        plan.totalExpected,
        t.totalOverride,
        t.termValue,
        t.termUnit,
        plan.termDays,
        t.cycleValue,
        t.cycleUnit,
        t.method,
        t.firstDueDate,
        t.installmentAmount,
        plan.expiryDate,
        t.expiryOverride,
      );
    const id = Number(r.lastInsertRowid);
    insertSchedules(db, id, plan);
    audit(db, user, "investment", id, id, "create", {
      code,
      principal: plan.principal,
      rate: plan.rate,
      totalExpected: plan.totalExpected,
      term: termLabel(t.termValue, t.termUnit),
      cycle: cycleLabel(t.cycleValue, t.cycleUnit),
      method: METHODS[t.method].label,
      count: plan.count,
    });
    return id;
  });
}

const TERM_FIELDS = {
  exec_date: "execDate",
  principal: "principal",
  rate: "rate",
  total_override: "totalExpected",
  term_value: "termValue",
  term_unit: "termUnit",
  cycle_value: "cycleValue",
  cycle_unit: "cycleUnit",
  method: "method",
  first_due_date: "firstDueDate",
  installment_amount: "installmentAmount",
  expiry_override: "expiryDate",
};

export function invToInput(inv) {
  return {
    execDate: inv.exec_date,
    principal: inv.principal,
    rate: inv.rate,
    totalExpected: inv.total_override,
    termValue: inv.term_value,
    termUnit: inv.term_unit,
    cycleValue: inv.cycle_value,
    cycleUnit: inv.cycle_unit,
    method: inv.method,
    firstDueDate: inv.first_due_date,
    installmentAmount: inv.installment_amount,
    expiryDate: inv.expiry_override,
  };
}

export function getInvestmentRow(db, id) {
  const inv = db.prepare("SELECT * FROM investments WHERE investment_id = ? AND deleted_at IS NULL").get(id);
  if (!inv) throw Object.assign(new UserError("투자건을 찾을 수 없습니다."), { status: 404 });
  return inv;
}

export function updateInvestment(db, id, input, user) {
  const inv = getInvestmentRow(db, id);
  const merged = { ...invToInput(inv), ...input };
  const plan = planOrThrow(merged);
  const t = plan.terms;
  const newVals = {
    exec_date: t.execDate,
    principal: plan.principal,
    rate: plan.rate,
    total_override: t.totalOverride,
    term_value: t.termValue,
    term_unit: t.termUnit,
    cycle_value: t.cycleValue,
    cycle_unit: t.cycleUnit,
    method: t.method,
    first_due_date: t.firstDueDate,
    installment_amount: t.installmentAmount,
    expiry_override: t.expiryOverride,
  };
  const termChanges = {};
  for (const k of Object.keys(TERM_FIELDS)) if (String(inv[k] ?? "") !== String(newVals[k] ?? "")) termChanges[k] = [inv[k], newVals[k]];
  const regenerate = Object.keys(termChanges).length > 0;

  return tx(db, () => {
    const info = {
      manager: input.manager !== undefined ? str(input.manager, 100) : inv.manager,
      contact: input.contact !== undefined ? str(input.contact, 50) : inv.contact,
      category: input.category !== undefined ? str(input.category, 50) : inv.category,
      memo: input.memo !== undefined ? str(input.memo, 2000) : inv.memo,
    };
    let customerId = inv.customer_id;
    if (input.customerId || input.customerName)
      customerId = upsertCustomer(db, { customerId: input.customerId, name: input.customerName, phone: input.customerPhone }, user);
    let companyId = inv.company_id;
    if (input.companyId || input.companyName)
      companyId = upsertCompany(db, { companyId: input.companyId, name: input.companyName, manager: info.manager, phone: info.contact }, user);

    db.prepare(
      `UPDATE investments SET customer_id=?, company_id=?, manager=?, contact=?, category=?, memo=?, exec_date=?, principal=?, rate=?,
        total_expected=?, total_override=?, term_value=?, term_unit=?, term_days=?, cycle_value=?, cycle_unit=?, method=?,
        first_due_date=?, installment_amount=?, expiry_date=?, expiry_override=?, updated_at=datetime('now')
       WHERE investment_id=?`,
    ).run(
      customerId,
      companyId,
      info.manager,
      info.contact,
      info.category,
      info.memo,
      t.execDate,
      plan.principal,
      plan.rate,
      plan.totalExpected,
      t.totalOverride,
      t.termValue,
      t.termUnit,
      plan.termDays,
      t.cycleValue,
      t.cycleUnit,
      t.method,
      t.firstDueDate,
      t.installmentAmount,
      plan.expiryDate,
      t.expiryOverride,
      id,
    );
    if (regenerate) {
      db.prepare("DELETE FROM schedules WHERE investment_id = ?").run(id);
      insertSchedules(db, id, plan);
      // 회차가 줄어 사라진 회차를 지정한 입금은 '회차 미지정'으로 돌린다 (입금 기록은 보존)
      db.prepare("UPDATE payments SET seq = NULL WHERE investment_id = ? AND seq > ?").run(id, plan.count);
    }
    const infoChanges = diff(
      { manager: inv.manager, contact: inv.contact, category: inv.category, memo: inv.memo, customer_id: inv.customer_id, company_id: inv.company_id },
      { ...info, customer_id: customerId, company_id: companyId },
    );
    const all = { ...termChanges, ...infoChanges };
    if (inv.total_expected !== plan.totalExpected) all.total_expected = [inv.total_expected, plan.totalExpected];
    if (Object.keys(all).length) audit(db, user, "investment", id, id, regenerate ? "update+reschedule" : "update", all);
    return { regenerated: regenerate };
  });
}

export function deleteInvestment(db, id, user) {
  const inv = getInvestmentRow(db, id);
  db.prepare("UPDATE investments SET deleted_at = datetime('now'), status = 'deleted' WHERE investment_id = ?").run(id);
  audit(db, user, "investment", id, id, "delete", { code: inv.code, principal: inv.principal });
}

// 회차 금액 직접 수정. adjustLast=true 면 차액을 마지막 회차에서 조정해 총액 유지
export function updateScheduleAmount(db, id, seq, amount, adjustLast, user) {
  const inv = getInvestmentRow(db, id);
  amount = toWon(amount);
  if (!Number.isInteger(amount) || amount < 0) throw new UserError("금액을 올바르게 입력하세요.");
  const rows = db.prepare("SELECT seq, amount FROM schedules WHERE investment_id = ? ORDER BY seq").all(id);
  const row = rows.find((r) => r.seq === Number(seq));
  if (!row) throw new UserError("회차를 찾을 수 없습니다.");
  const delta = amount - row.amount;
  if (delta === 0) return;
  return tx(db, () => {
    db.prepare("UPDATE schedules SET amount = ? WHERE investment_id = ? AND seq = ?").run(amount, id, row.seq);
    const last = rows[rows.length - 1];
    let newTotal = inv.total_expected + delta;
    const detail = { seq: row.seq, amount: [row.amount, amount] };
    if (adjustLast && last.seq !== row.seq) {
      const lastAmt = last.amount - delta;
      if (lastAmt < 0) throw new UserError("마지막 회차 금액이 음수가 됩니다. 조정 없이 저장하거나 금액을 줄이세요.");
      db.prepare("UPDATE schedules SET amount = ? WHERE investment_id = ? AND seq = ?").run(lastAmt, id, last.seq);
      detail.lastSeq = { seq: last.seq, amount: [last.amount, lastAmt] };
      newTotal = inv.total_expected;
    } else {
      detail.total_expected = [inv.total_expected, newTotal];
      db.prepare("UPDATE investments SET total_expected = ?, total_override = ? WHERE investment_id = ?").run(newTotal, newTotal, id);
    }
    db.prepare("UPDATE investments SET method = CASE WHEN method = 'equal_total' THEN 'manual' ELSE method END, updated_at = datetime('now') WHERE investment_id = ?").run(id);
    audit(db, user, "schedule", row.seq, id, "amount", detail);
  });
}

// ---------- 입금 ----------
function checkPayment({ amount, paidDate }) {
  amount = toWon(amount);
  if (!Number.isInteger(amount) || amount === 0) throw new UserError("입금액을 입력하세요.");
  if (!isDate(paidDate)) throw new UserError("입금일을 입력하세요.");
  return amount;
}

export function addPayment(db, id, { amount, paidDate, seq, memo }, user) {
  const inv = getInvestmentRow(db, id);
  amount = checkPayment({ amount, paidDate });
  if (seq != null && seq !== "") {
    const ok = db.prepare("SELECT 1 FROM schedules WHERE investment_id = ? AND seq = ?").get(id, Number(seq));
    if (!ok) throw new UserError("회차를 찾을 수 없습니다.");
  }
  const r = db
    .prepare("INSERT INTO payments(investment_id, seq, paid_date, amount, memo, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, seq == null || seq === "" ? null : Number(seq), paidDate, amount, str(memo, 200), user ?? "");
  audit(db, user, "payment", Number(r.lastInsertRowid), id, "create", { code: inv.code, seq: seq ?? null, paidDate, amount });
  return Number(r.lastInsertRowid);
}

// 선택한 회차들을 예정일자로 잔액 전액 입금 처리
export function payInstallmentsFull(db, id, seqs, asOf, user) {
  const calc = computeOne(db, id, "9999-12-31");
  return tx(db, () => {
    let n = 0;
    for (const s of seqs) {
      const r = calc.rows.find((x) => x.seq === Number(s));
      if (!r || r.shortfall <= 0) continue;
      const date = r.dueDate <= asOf ? r.dueDate : asOf;
      addPayment(db, id, { amount: r.shortfall, paidDate: date, seq: r.seq, memo: "전액 입금" }, user);
      n++;
    }
    return n;
  });
}

export function updatePayment(db, paymentId, { amount, paidDate, memo, seq }, user) {
  const p = db.prepare("SELECT * FROM payments WHERE payment_id = ?").get(paymentId);
  if (!p) throw new UserError("입금 기록을 찾을 수 없습니다.");
  amount = checkPayment({ amount, paidDate });
  const nseq = seq === undefined ? p.seq : seq === null || seq === "" ? null : Number(seq);
  db.prepare("UPDATE payments SET amount = ?, paid_date = ?, memo = ?, seq = ? WHERE payment_id = ?").run(
    amount,
    paidDate,
    str(memo ?? p.memo, 200),
    nseq,
    paymentId,
  );
  audit(db, user, "payment", paymentId, p.investment_id, "update", diff(
    { amount: p.amount, paid_date: p.paid_date, seq: p.seq },
    { amount, paid_date: paidDate, seq: nseq },
  ));
}

export function deletePayment(db, paymentId, user) {
  const p = db.prepare("SELECT * FROM payments WHERE payment_id = ?").get(paymentId);
  if (!p) throw new UserError("입금 기록을 찾을 수 없습니다.");
  db.prepare("DELETE FROM payments WHERE payment_id = ?").run(paymentId);
  audit(db, user, "payment", paymentId, p.investment_id, "delete", { seq: p.seq, paidDate: p.paid_date, amount: p.amount });
}

// ---------- 조회 ----------
const INV_SELECT = `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone, co.name AS company_name,
  co.manager AS company_manager, co.phone AS company_phone
  FROM investments i JOIN customers c ON c.customer_id = i.customer_id
  JOIN companies co ON co.investment_company_id = i.company_id WHERE i.deleted_at IS NULL`;

export function loadAll(db, where = "", params = []) {
  const invs = db.prepare(`${INV_SELECT} ${where} ORDER BY i.exec_date DESC, i.investment_id DESC`).all(...params);
  if (!invs.length) return [];
  const ids = new Set(invs.map((i) => i.investment_id));
  const sch = new Map();
  for (const s of db.prepare("SELECT investment_id, seq, due_date, amount FROM schedules ORDER BY investment_id, seq").all()) {
    if (!ids.has(s.investment_id)) continue;
    if (!sch.has(s.investment_id)) sch.set(s.investment_id, []);
    sch.get(s.investment_id).push(s);
  }
  const pay = new Map();
  for (const p of db.prepare("SELECT payment_id AS id, investment_id, seq, paid_date, amount, memo, created_at, created_by FROM payments").all()) {
    if (!ids.has(p.investment_id)) continue;
    if (!pay.has(p.investment_id)) pay.set(p.investment_id, []);
    pay.get(p.investment_id).push(p);
  }
  return invs.map((inv) => ({
    inv: { ...inv, id: inv.investment_id },
    schedules: sch.get(inv.investment_id) ?? [],
    payments: pay.get(inv.investment_id) ?? [],
  }));
}

export function computeAll(db, asOf, where = "", params = []) {
  const settings = getSettings(db);
  return loadAll(db, where, params).map((it) => ({
    ...it,
    calc: computeInvestment(it.inv, it.schedules, it.payments, asOf, settings),
  }));
}

export function computeOne(db, id, asOf) {
  const [it] = computeAll(db, asOf, "AND i.investment_id = ?", [id]);
  if (!it) throw Object.assign(new UserError("투자건을 찾을 수 없습니다."), { status: 404 });
  return it.calc;
}

// 목록/엑셀용 요약 행
export function summaryRow({ inv, calc }) {
  return {
    id: inv.investment_id,
    code: inv.code,
    customerId: inv.customer_id,
    customerName: inv.customer_name,
    companyId: inv.company_id,
    companyName: inv.company_name,
    category: inv.category,
    manager: inv.manager,
    execDate: inv.exec_date,
    principal: inv.principal,
    rate: inv.rate,
    profit: calc.profit,
    totalExpected: calc.totalExpected,
    term: termLabel(inv.term_value, inv.term_unit),
    termValue: inv.term_value,
    termUnit: inv.term_unit,
    termDays: inv.term_days,
    cycle: cycleLabel(inv.cycle_value, inv.cycle_unit),
    method: METHODS[inv.method]?.label ?? inv.method,
    methodKey: inv.method,
    perAmount: calc.rows[0]?.amount ?? 0,
    expiryDate: inv.expiry_date,
    collected: calc.collected,
    outstanding: calc.outstanding,
    progressPct: calc.progressPct,
    overdueAmount: calc.overdueAmount,
    maxDelay: calc.maxDelay,
    elapsedDays: calc.elapsedDays,
    remainingDays: calc.remainingDays,
    totalDays: calc.totalDays,
    status: calc.status,
    statusLevel: calc.statusLevel,
    expiry: calc.expiry,
    flags: calc.flags,
    nextDue: calc.nextDue,
    installments: calc.installments,
    doneCount: calc.doneCount,
    started: calc.started,
  };
}
