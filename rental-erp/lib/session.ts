// 로그인 세션 쿠키 (HMAC 서명 토큰). proxy.ts(모든 요청)와 서버 코드에서 함께 쓴다. Edge/Node 모두 동작.

export const SESSION_COOKIE = "rental_session";

export type SessionPayload = { u: string; v: number; e: number }; // 사용자 id, 세션 버전, 만료(초)

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** 서명 키: SESSION_SECRET, 없으면 DB 주소(비밀번호 포함)에서 만든다 → 따로 설정할 필요 없음 */
function secretSource(): string {
  const k = process.env.SESSION_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!k) throw new Error("환경변수 SESSION_SECRET 또는 DATABASE_URL 이 필요합니다.");
  return k.trim();
}

async function hmacKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`rental-erp/session/v1:${secretSource()}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(p: SessionPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(p)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** 서명과 만료를 확인. 올바르지 않으면 null */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    if (typeof p.u !== "string" || typeof p.v !== "number" || typeof p.e !== "number") return null;
    if (p.e * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
