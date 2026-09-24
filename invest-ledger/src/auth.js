import crypto from "node:crypto";

const SESSION_HOURS = 12;
export const COOKIE = "ledger_sid";

// 비밀번호 암호화: scrypt + 개별 salt
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(h, "base64");
  const actual = crypto.scryptSync(pw, Buffer.from(s, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  return null;
}

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

export function createSession(db, userId, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash, user_id, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?)").run(
    sha(token),
    userId,
    Date.now() + SESSION_HOURS * 3600e3,
    req.ip ?? "",
    String(req.headers["user-agent"] ?? "").slice(0, 200),
  );
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  return token;
}

export function getSessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      "SELECT s.token_hash, s.expires_at, u.user_id, u.username, u.role FROM sessions s JOIN users u ON u.user_id = s.user_id WHERE s.token_hash = ?",
    )
    .get(sha(token));
  if (!row || row.expires_at < Date.now()) return null;
  // 슬라이딩 만료: 사용 중이면 연장
  if (row.expires_at - Date.now() < (SESSION_HOURS * 3600e3) / 2) {
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(Date.now() + SESSION_HOURS * 3600e3, row.token_hash);
  }
  return { id: row.user_id, username: row.username, role: row.role };
}

export function destroySession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

// 비밀번호 변경 시 다른 기기의 세션은 모두 종료
export function destroyOtherSessions(db, userId, token) {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(userId, sha(token ?? ""));
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, secure) {
  const attrs = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${SESSION_HOURS * 3600}`];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// 간단한 로그인 시도 제한 (IP당 10분에 10회)
const attempts = new Map();
export function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60e3);
  attempts.set(ip, list);
  return list.length >= 10;
}
export function recordFailure(ip) {
  const list = attempts.get(ip) ?? [];
  list.push(Date.now());
  attempts.set(ip, list);
}
