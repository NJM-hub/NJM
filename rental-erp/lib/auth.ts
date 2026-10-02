import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { q1 } from "@/lib/db";
import { atLeast, isRole, permissionsOf, type Role } from "@/lib/permissions";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

export type CurrentUser = { id: string; email: string; name: string; role: Role; sessionVersion: number };

/** 현재 로그인한 사용자 (한 요청 안에서는 한 번만 조회) */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const p = await verifySession(token);
  if (!p) return null;
  const u = await q1<{ id: string; email: string; name: string; role: string; is_active: boolean; session_version: number }>(
    "select id, email, name, role, is_active, session_version from users where id = $1",
    [p.u],
  ).catch(() => null);
  if (!u || !u.is_active || u.session_version !== p.v || !isRole(u.role)) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, sessionVersion: u.session_version };
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** 화면용: 사용자 + 권한 */
export async function requirePage(min: Role = "viewer") {
  const user = await requireUser();
  if (!atLeast(user.role, min)) redirect("/?denied=1");
  return { user, can: permissionsOf(user.role) };
}

/**
 * 서버 동작(저장 등)용 권한 확인.
 *   const a = await authorize("staff"); if ("denied" in a) return a.denied;
 */
export async function authorize(min: Role): Promise<{ user: CurrentUser } | { denied: { error: string } }> {
  const u = await getCurrentUser();
  if (!u) return { denied: { error: "로그인이 만료되었습니다. 다시 로그인하세요." } };
  if (!atLeast(u.role, min)) {
    return { denied: { error: min === "admin" ? "관리자만 할 수 있는 작업입니다." : "권한이 없습니다. (조회자 계정)" } };
  }
  return { user: u };
}

const DAY = 24 * 60 * 60;

export async function startSession(userId: string, version: number, keep: boolean) {
  const maxAge = keep ? 30 * DAY : 12 * 60 * 60;
  const token = await signSession({ u: userId, v: version, e: Math.floor(Date.now() / 1000) + maxAge });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
