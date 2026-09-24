import express from "express";
import path from "node:path";
import fs from "node:fs";
import { openDb, getSettings, setSetting, backupDb, DATA_DIR, tx } from "./src/db.js";
import * as auth from "./src/auth.js";
import * as repo from "./src/repo.js";
import { computePortfolio, computeMonthly } from "./src/ledger.js";
import { buildPlan, METHODS, UNIT_LABEL, cycleLabel, termLabel } from "./src/schedule.js";
import { isDate, todayKST, monthStart, monthEnd } from "./src/dates.js";
import { buildExport, parseImport } from "./src/excel.js";

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || "0.0.0.0";
const SECURE_COOKIE = process.env.COOKIE_SECURE === "1";

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "1");

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
    );
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use("/vendor/chart.umd.js", (req, res) =>
    res.sendFile(path.resolve(import.meta.dirname, "node_modules/chart.js/dist/chart.umd.min.js")),
  );
  app.use(express.static(path.resolve(import.meta.dirname, "public"), { index: "index.html" }));

  const api = express.Router();

  // 세션 확인
  api.use((req, res, next) => {
    const token = auth.parseCookies(req.headers.cookie)[auth.COOKIE];
    req.token = token;
    req.user = auth.getSessionUser(db, token);
    // 상태 변경 요청은 커스텀 헤더 필수 (CSRF 방지)
    if (req.method !== "GET" && req.headers["x-ledger"] !== "1") return res.status(403).json({ error: "잘못된 요청" });
    next();
  });

  const needsSetup = () => db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0;

  api.get("/session", (req, res) => {
    res.json({ user: req.user, needsSetup: needsSetup(), today: todayKST() });
  });

  api.post("/setup", (req, res) => {
    if (!needsSetup()) return res.status(400).json({ error: "이미 관리자 계정이 있습니다." });
    const { username, password } = req.body ?? {};
    const err = auth.validatePassword(password);
    if (!username || err) return res.status(400).json({ error: err ?? "아이디를 입력하세요." });
    const r = db.prepare("INSERT INTO users(username, password_hash, role) VALUES (?, ?, 'admin')").run(String(username).trim(), auth.hashPassword(password));
    const token = auth.createSession(db, Number(r.lastInsertRowid), req);
    res.setHeader("Set-Cookie", auth.sessionCookie(token, SECURE_COOKIE));
    res.json({ ok: true });
  });

  api.post("/login", (req, res) => {
    const ip = req.ip ?? "";
    if (auth.tooManyAttempts(ip)) return res.status(429).json({ error: "로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요." });
    const { username, password } = req.body ?? {};
    const u = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username ?? "").trim());
    if (!u || !auth.verifyPassword(String(password ?? ""), u.password_hash)) {
      auth.recordFailure(ip);
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE user_id = ?").run(u.user_id);
    const token = auth.createSession(db, u.user_id, req);
    res.setHeader("Set-Cookie", auth.sessionCookie(token, SECURE_COOKIE));
    res.json({ ok: true });
  });

  api.post("/logout", (req, res) => {
    auth.destroySession(db, req.token);
    res.setHeader("Set-Cookie", auth.clearCookie());
    res.json({ ok: true });
  });

  // 이하 로그인 필요
  api.use((req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "로그인이 필요합니다." });
    next();
  });

  const asOfOf = (req) => (isDate(req.query.asOf) ? req.query.asOf : todayKST());
  const uname = (req) => req.user.username;

  api.get("/meta", (req, res) => {
    res.json({
      methods: Object.entries(METHODS).map(([key, m]) => ({ key, label: m.label, singlePayment: !!m.singlePayment, allowCustomAmount: !!m.allowCustomAmount })),
      units: UNIT_LABEL,
      settings: getSettings(db),
      customers: db.prepare("SELECT customer_id AS id, name, phone FROM customers ORDER BY name").all(),
      companies: db.prepare("SELECT investment_company_id AS id, name, manager, phone FROM companies ORDER BY name").all(),
      categories: db.prepare("SELECT DISTINCT category FROM investments WHERE category <> '' AND deleted_at IS NULL ORDER BY category").all().map((r) => r.category),
    });
  });

  // ----- 대시보드 -----
  api.get("/dashboard", (req, res) => {
    const asOf = asOfOf(req);
    const items = repo.computeAll(db, asOf);
    const totals = computePortfolio(items, asOf);
    const year = Number(asOf.slice(0, 4));
    const monthly = computeMonthly(items, asOf, year);
    const rows = items.filter((it) => it.calc.started).map(repo.summaryRow);
    const attention = rows
      .filter((r) => r.status !== "완납" && (r.status !== "정상" || r.flags.expiringSoon))
      .sort((a, b) => b.maxDelay - a.maxDelay || a.expiry.daysLeft - b.expiry.daysLeft)
      .slice(0, 12);
    const todayDue = [];
    for (const it of items)
      for (const r of it.calc.rows)
        if (r.dueDate === asOf)
          todayDue.push({ id: it.inv.investment_id, code: it.inv.code, customerName: it.inv.customer_name, companyName: it.inv.company_name, ...r, rows: undefined });
    res.json({ asOf, totals, monthly, attention, todayDue });
  });

  // ----- 투자 목록 / 검색 / 필터 -----
  api.get("/investments", (req, res) => {
    const asOf = asOfOf(req);
    const q = String(req.query.q ?? "").trim();
    const where = q ? "AND (c.name LIKE ? OR co.name LIKE ? OR i.code LIKE ? OR i.category LIKE ?)" : "";
    const params = q ? Array(4).fill(`%${q}%`) : [];
    let rows = repo.computeAll(db, asOf, where, params).map(repo.summaryRow);
    const f = String(req.query.filter ?? "all");
    const filters = {
      all: () => true,
      normal: (r) => r.status === "정상",
      partial: (r) => r.flags.partial,
      unpaid: (r) => r.flags.unpaid,
      overdue: (r) => r.status === "연체",
      expiring: (r) => r.flags.expiringSoon,
      paidoff: (r) => r.status === "완납",
      active: (r) => r.status !== "완납",
    };
    rows = rows.filter(filters[f] ?? filters.all);
    if (req.query.customerId) rows = rows.filter((r) => r.customerId === Number(req.query.customerId));
    if (req.query.companyId) rows = rows.filter((r) => r.companyId === Number(req.query.companyId));
    const sum = (k) => rows.filter((r) => r.started).reduce((a, r) => a + r[k], 0);
    res.json({
      asOf,
      rows,
      totals: { count: rows.length, principal: sum("principal"), totalExpected: sum("totalExpected"), collected: sum("collected"), outstanding: sum("outstanding"), overdueAmount: sum("overdueAmount") },
    });
  });

  api.post("/investments/preview", (req, res) => {
    const plan = buildPlan(req.body ?? {});
    if (!plan.ok) return res.json(plan);
    res.json({
      ...plan,
      termLabel: termLabel(plan.terms.termValue, plan.terms.termUnit),
      cycleLabel: cycleLabel(plan.terms.cycleValue, plan.terms.cycleUnit),
      methodLabel: METHODS[plan.terms.method].label,
      installments: plan.installments.length > 400 ? [...plan.installments.slice(0, 200), ...plan.installments.slice(-5)] : plan.installments,
    });
  });

  api.post("/investments", (req, res) => {
    const id = repo.createInvestment(db, req.body ?? {}, uname(req));
    res.json({ id });
  });

  api.get("/investments/:id", (req, res) => {
    const asOf = asOfOf(req);
    const id = Number(req.params.id);
    const [it] = repo.computeAll(db, asOf, "AND i.investment_id = ?", [id]);
    if (!it) return res.status(404).json({ error: "투자건을 찾을 수 없습니다." });
    const payments = [...it.payments].sort((a, b) => (a.paid_date < b.paid_date ? 1 : a.paid_date > b.paid_date ? -1 : b.id - a.id));
    res.json({
      asOf,
      inv: it.inv,
      input: repo.invToInput(it.inv),
      summary: repo.summaryRow(it),
      rows: it.calc.rows,
      payments: payments.map((p) => ({ ...p, future: p.paid_date > asOf })),
      audit: db.prepare("SELECT * FROM audit_log WHERE investment_id = ? ORDER BY audit_id DESC LIMIT 200").all(id),
    });
  });

  api.put("/investments/:id", (req, res) => {
    res.json(repo.updateInvestment(db, Number(req.params.id), req.body ?? {}, uname(req)));
  });

  api.delete("/investments/:id", (req, res) => {
    repo.deleteInvestment(db, Number(req.params.id), uname(req));
    res.json({ ok: true });
  });

  api.put("/investments/:id/schedules/:seq", (req, res) => {
    repo.updateScheduleAmount(db, Number(req.params.id), Number(req.params.seq), req.body?.amount, !!req.body?.adjustLast, uname(req));
    res.json({ ok: true });
  });

  api.post("/investments/:id/payments", (req, res) => {
    res.json({ id: repo.addPayment(db, Number(req.params.id), req.body ?? {}, uname(req)) });
  });

  api.post("/investments/:id/payments/full", (req, res) => {
    const seqs = Array.isArray(req.body?.seqs) ? req.body.seqs : [];
    res.json({ count: repo.payInstallmentsFull(db, Number(req.params.id), seqs, asOfOf(req), uname(req)) });
  });

  api.put("/payments/:id", (req, res) => {
    repo.updatePayment(db, Number(req.params.id), req.body ?? {}, uname(req));
    res.json({ ok: true });
  });

  api.delete("/payments/:id", (req, res) => {
    repo.deletePayment(db, Number(req.params.id), uname(req));
    res.json({ ok: true });
  });

  // ----- 고객 / 투자처 -----
  function groupSummary(rows) {
    const s = { count: rows.length, principal: 0, totalExpected: 0, collected: 0, outstanding: 0, overdueAmount: 0, profit: 0, worst: "정상" };
    const rank = { 연체: 5, 일부입금: 4, 지연: 3, 정상: 2, 완납: 1, 실행전: 0 };
    let w = 0;
    for (const r of rows) {
      if (!r.started) continue;
      s.principal += r.principal;
      s.totalExpected += r.totalExpected;
      s.collected += r.collected;
      s.outstanding += r.outstanding;
      s.overdueAmount += r.overdueAmount;
      s.profit += r.profit;
      if (rank[r.status] > w) {
        w = rank[r.status];
        s.worst = r.status;
      }
    }
    if (!rows.length) s.worst = "-";
    return s;
  }

  api.get("/customers", (req, res) => {
    const asOf = asOfOf(req);
    const rows = repo.computeAll(db, asOf).map(repo.summaryRow);
    const q = String(req.query.q ?? "").trim();
    const list = db
      .prepare("SELECT customer_id AS id, name, phone, memo FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name")
      .all(`%${q}%`, `%${q}%`)
      .map((c) => ({ ...c, ...groupSummary(rows.filter((r) => r.customerId === c.id)) }));
    res.json({ asOf, rows: list });
  });

  api.get("/customers/:id", (req, res) => {
    const asOf = asOfOf(req);
    const id = Number(req.params.id);
    const c = db.prepare("SELECT customer_id AS id, name, phone, memo, created_at FROM customers WHERE customer_id = ?").get(id);
    if (!c) return res.status(404).json({ error: "고객을 찾을 수 없습니다." });
    const rows = repo.computeAll(db, asOf, "AND i.customer_id = ?", [id]).map(repo.summaryRow);
    res.json({ asOf, customer: c, summary: groupSummary(rows), rows });
  });

  api.put("/customers/:id", (req, res) => {
    repo.updateCustomer(db, Number(req.params.id), req.body ?? {}, uname(req));
    res.json({ ok: true });
  });

  api.post("/customers", (req, res) => {
    res.json({ id: repo.upsertCustomer(db, req.body ?? {}, uname(req)) });
  });

  api.get("/companies", (req, res) => {
    const asOf = asOfOf(req);
    const rows = repo.computeAll(db, asOf).map(repo.summaryRow);
    const list = db
      .prepare("SELECT investment_company_id AS id, name, manager, phone, memo FROM companies ORDER BY name")
      .all()
      .map((c) => ({ ...c, ...groupSummary(rows.filter((r) => r.companyId === c.id)) }));
    res.json({ asOf, rows: list });
  });

  api.get("/companies/:id", (req, res) => {
    const asOf = asOfOf(req);
    const id = Number(req.params.id);
    const c = db.prepare("SELECT investment_company_id AS id, name, manager, phone, memo FROM companies WHERE investment_company_id = ?").get(id);
    if (!c) return res.status(404).json({ error: "투자처를 찾을 수 없습니다." });
    const rows = repo.computeAll(db, asOf, "AND i.company_id = ?", [id]).map(repo.summaryRow);
    res.json({ asOf, company: c, summary: groupSummary(rows), rows });
  });

  api.put("/companies/:id", (req, res) => {
    repo.updateCompany(db, Number(req.params.id), req.body ?? {}, uname(req));
    res.json({ ok: true });
  });

  api.post("/companies", (req, res) => {
    res.json({ id: repo.upsertCompany(db, req.body ?? {}, uname(req)) });
  });

  // ----- 통계 / 캘린더 / 날짜별 -----
  api.get("/stats/monthly", (req, res) => {
    const asOf = asOfOf(req);
    const year = Number(req.query.year) || Number(asOf.slice(0, 4));
    const items = repo.computeAll(db, asOf);
    const years = new Set([Number(asOf.slice(0, 4))]);
    for (const it of items) {
      years.add(Number(it.inv.exec_date.slice(0, 4)));
      for (const r of it.calc.rows) years.add(Number(r.dueDate.slice(0, 4)));
    }
    res.json({ asOf, year, years: [...years].sort(), months: computeMonthly(items, asOf, year), totals: computePortfolio(items, asOf) });
  });

  api.get("/calendar", (req, res) => {
    const asOf = asOfOf(req);
    const month = /^\d{4}-\d{2}$/.test(req.query.month ?? "") ? req.query.month : asOf.slice(0, 7);
    const from = monthStart(month + "-01");
    const to = monthEnd(from);
    const days = {};
    for (const it of repo.computeAll(db, asOf)) {
      for (const r of it.calc.rows) {
        if (r.dueDate < from || r.dueDate > to) continue;
        const d = (days[r.dueDate] ??= { date: r.dueDate, due: 0, paid: 0, shortfall: 0, count: 0, worst: "done", items: [] });
        d.due += r.amount;
        d.paid += r.paid;
        d.shortfall += r.shortfall;
        d.count++;
        d.items.push({ id: it.inv.investment_id, code: it.inv.code, customerName: it.inv.customer_name, companyName: it.inv.company_name, seq: r.seq, amount: r.amount, paid: r.paid, shortfall: r.shortfall, status: r.status, level: r.level, delayDays: r.delayDays });
      }
    }
    const rank = { overdue: 6, delay: 5, partial: 4, today: 3, future: 2, done: 1 };
    for (const d of Object.values(days)) {
      d.worst = d.items.reduce((w, i) => (rank[i.level] > rank[w] ? i.level : w), "done");
      d.items.sort((a, b) => b.amount - a.amount);
    }
    res.json({ asOf, month, days });
  });

  api.get("/daily", (req, res) => {
    const date = isDate(req.query.date) ? req.query.date : asOfOf(req);
    const items = repo.computeAll(db, date);
    const totals = computePortfolio(items, date);
    const list = [];
    for (const it of items)
      for (const r of it.calc.rows)
        if (r.dueDate === date || (r.dueDate < date && r.shortfall > 0))
          list.push({ id: it.inv.investment_id, code: it.inv.code, customerName: it.inv.customer_name, companyName: it.inv.company_name, seq: r.seq, dueDate: r.dueDate, amount: r.amount, paid: r.paid, shortfall: r.shortfall, status: r.status, level: r.level, delayDays: r.delayDays });
    list.sort((a, b) => (a.dueDate === date) - (b.dueDate === date) || a.dueDate.localeCompare(b.dueDate));
    const payments = [];
    for (const it of items)
      for (const p of it.payments)
        if (p.paid_date === date) payments.push({ id: p.id, investmentId: it.inv.investment_id, code: it.inv.code, customerName: it.inv.customer_name, seq: p.seq, amount: p.amount, memo: p.memo });
    res.json({ date, totals, list, payments });
  });

  // ----- 엑셀 -----
  api.get("/export/:kind", async (req, res) => {
    const asOf = asOfOf(req);
    const items = repo.computeAll(db, asOf);
    const { buffer, filename } = await buildExport(req.params.kind, items, {
      asOf,
      year: Number(req.query.year) || Number(asOf.slice(0, 4)),
      customerId: req.query.customerId,
      investmentId: req.query.investmentId,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  });

  api.post("/import/preview", express.raw({ type: "application/octet-stream", limit: "10mb" }), async (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: "파일이 비어 있습니다." });
    try {
      res.json(await parseImport(req.body));
    } catch (e) {
      res.status(400).json({ error: `엑셀 파일을 읽을 수 없습니다: ${e.message}` });
    }
  });

  api.post("/import/commit", (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const today = todayKST();
    backupDb(db, "before-import");
    const created = tx(db, () => {
      const ids = [];
      for (const input of rows) {
        const id = repo.createInvestment(db, input, uname(req));
        let left = Number(input.collected) || 0;
        if (left > 0) {
          const sch = db.prepare("SELECT seq, due_date, amount FROM schedules WHERE investment_id = ? ORDER BY seq").all(id);
          for (const s of sch) {
            if (left <= 0) break;
            const amt = Math.min(left, s.amount);
            repo.addPayment(db, id, { amount: amt, paidDate: s.due_date <= today ? s.due_date : today, seq: s.seq, memo: "엑셀 이관" }, uname(req));
            left -= amt;
          }
        }
        ids.push(id);
      }
      return ids;
    });
    res.json({ count: created.length });
  });

  // ----- 설정 / 계정 / 백업 -----
  api.get("/settings", (req, res) => {
    const dir = path.join(DATA_DIR, "backups");
    const backups = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().reverse().slice(0, 30).map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }))
      : [];
    res.json({
      settings: getSettings(db),
      users: db.prepare("SELECT user_id AS id, username, role, created_at, last_login FROM users ORDER BY user_id").all(),
      backups,
      audit: db.prepare("SELECT a.*, i.code FROM audit_log a LEFT JOIN investments i ON i.investment_id = a.investment_id ORDER BY audit_id DESC LIMIT 100").all(),
    });
  });

  api.put("/settings", (req, res) => {
    const d = Number(req.body?.overdueDays);
    if (!Number.isInteger(d) || d < 0 || d > 365) return res.status(400).json({ error: "연체 기준일은 0~365 사이 정수" });
    const before = getSettings(db).overdueDays;
    setSetting(db, "overdueDays", d);
    repo.audit(db, uname(req), "settings", null, null, "update", { overdueDays: [before, d] });
    res.json({ ok: true });
  });

  api.post("/password", (req, res) => {
    const { current, next } = req.body ?? {};
    const u = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.user.id);
    if (!auth.verifyPassword(String(current ?? ""), u.password_hash)) return res.status(400).json({ error: "현재 비밀번호가 올바르지 않습니다." });
    const err = auth.validatePassword(next);
    if (err) return res.status(400).json({ error: err });
    db.prepare("UPDATE users SET password_hash = ? WHERE user_id = ?").run(auth.hashPassword(next), u.user_id);
    auth.destroyOtherSessions(db, u.user_id, req.token);
    repo.audit(db, uname(req), "user", u.user_id, null, "password", {});
    res.json({ ok: true });
  });

  api.post("/users", (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "관리자만 가능합니다." });
    const { username, password, role } = req.body ?? {};
    const err = auth.validatePassword(password);
    if (!username || err) return res.status(400).json({ error: err ?? "아이디를 입력하세요." });
    if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(String(username).trim())) return res.status(400).json({ error: "이미 있는 아이디입니다." });
    db.prepare("INSERT INTO users(username, password_hash, role) VALUES (?, ?, ?)").run(String(username).trim(), auth.hashPassword(password), role === "staff" ? "staff" : "admin");
    repo.audit(db, uname(req), "user", null, null, "create", { username, role });
    res.json({ ok: true });
  });

  api.delete("/users/:id", (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "관리자만 가능합니다." });
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: "본인 계정은 삭제할 수 없습니다." });
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE user_id = ?").run(id);
    repo.audit(db, uname(req), "user", id, null, "delete", {});
    res.json({ ok: true });
  });

  api.post("/backup", (req, res) => {
    const file = backupDb(db, "manual");
    res.json({ ok: true, name: path.basename(file) });
  });

  api.get("/backup/download", (req, res) => {
    const file = backupDb(db, "download");
    res.download(file, `투자장부_백업_${todayKST()}.db`);
  });

  api.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof repo.UserError) return res.status(err.status ?? 400).json({ error: err.message, details: err.details });
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  });

  app.use("/api", api);
  app.use((req, res) => res.sendFile(path.resolve(import.meta.dirname, "public/index.html")));
  return app;
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const db = openDb();
  const app = createApp(db);
  // 매일 자동 백업 (시작 시 1회 + 24시간마다)
  try {
    backupDb(db, "startup");
  } catch (e) {
    console.error("백업 실패", e);
  }
  setInterval(() => {
    try {
      backupDb(db, "daily");
    } catch (e) {
      console.error("백업 실패", e);
    }
  }, 24 * 3600e3).unref();
  app.listen(PORT, HOST, () => {
    console.log(`투자수익 장부: http://localhost:${PORT}  (데이터: ${DATA_DIR})`);
  });
}
