import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.LEDGER_DATA_DIR || path.resolve(import.meta.dirname, "..", "data");
export const DB_PATH = path.join(DATA_DIR, "ledger.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS companies (
  investment_company_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS investments (
  investment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  company_id INTEGER NOT NULL REFERENCES companies(investment_company_id),
  manager TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  exec_date TEXT NOT NULL,
  principal INTEGER NOT NULL,
  rate TEXT NOT NULL,
  total_expected INTEGER NOT NULL,
  total_override INTEGER,
  term_value INTEGER NOT NULL,
  term_unit TEXT NOT NULL,
  term_days INTEGER NOT NULL,
  cycle_value INTEGER NOT NULL,
  cycle_unit TEXT NOT NULL,
  method TEXT NOT NULL,
  first_due_date TEXT NOT NULL,
  installment_amount INTEGER,
  expiry_date TEXT NOT NULL,
  expiry_override TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS schedules (
  schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(investment_id),
  seq INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  UNIQUE (investment_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_sched_due ON schedules(due_date);
CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(investment_id),
  seq INTEGER,
  paid_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pay_inv ON payments(investment_id);
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  username TEXT NOT NULL DEFAULT '',
  entity TEXT NOT NULL,
  entity_id INTEGER,
  investment_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_inv ON audit_log(investment_id);
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  ua TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDb(file = DB_PATH) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

// 트랜잭션 (중첩 호출 시 SAVEPOINT 사용)
const depth = new WeakMap();
export function tx(db, fn) {
  const d = depth.get(db) ?? 0;
  const sp = `sp${d}`;
  db.exec(d === 0 ? "BEGIN" : `SAVEPOINT ${sp}`);
  depth.set(db, d + 1);
  try {
    const r = fn();
    db.exec(d === 0 ? "COMMIT" : `RELEASE ${sp}`);
    return r;
  } catch (e) {
    db.exec(d === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw e;
  } finally {
    depth.set(db, d);
  }
}

export function getSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const s = { overdueDays: 7 };
  for (const r of rows) if (r.key === "overdueDays") s.overdueDays = Number(r.value) || 7;
  return s;
}

export function setSetting(db, key, value) {
  db.prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    String(value),
  );
}

// DB 백업: VACUUM INTO 로 일관된 스냅샷 파일 생성, 최근 30개 보관
export function backupDb(db, reason = "auto") {
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `ledger-${ts}-${reason}.db`);
  db.prepare("VACUUM INTO ?").run(file);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("ledger-") && f.endsWith(".db"))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(dir, f));
  return file;
}
