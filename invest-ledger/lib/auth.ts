import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { atLeast, isRole, permissionsOf, type Role } from "@/lib/permissions";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/session";
import { db } from "@/lib/supabase";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionVersion: number;
};

/** 현재 로그인한 사용자 (한 요청 안에서는 한 번만 조회). 없으면 null */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const p = await verifySession(token);
  if (!p) return null;
  const { data } = await db()
    .from("profiles")
    .select("id, email, display_name, role, is_active, session_version")
    .eq("id", p.u)
    .maybeSingle();
  // 계정이 중지됐거나 비밀번호가 바뀌어 세션 버전이 다르면 로그아웃된 것으로 본다
  if (!data || !data.is_active || data.session_version !== p.v || !isRole(data.role)) return null;
  return { id: data.id, email: data.email, name: data.display_name, role: data.role, sessionVersion: data.session_version };
});

/** 로그인 필요. 안 돼 있으면 로그인 화면으로 */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export class PermissionError extends Error {}

/** 서버 동작(저장 등)에서 권한 확인. 부족하면 오류 */
export async function requireRole(min: Role): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!atLeast(u.role, min)) {
    throw new PermissionError(min === "admin" ? "관리자만 할 수 있는 작업입니다." : "권한이 없습니다. (조회전용 계정)");
  }
  return u;
}

/** 화면용: 사용자 + 권한 묶음 */
export async function requirePage(min: Role = "viewer") {
  const user = await requireUser();
  if (!atLeast(user.role, min)) redirect("/?denied=1");
  return { user, can: permissionsOf(user.role) };
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

/**
 * 서버 동작용 권한 확인. 권한이 없으면 화면에 보여줄 오류를 돌려준다.
 *   const a = await authorize("staff"); if ("denied" in a) return a.denied;
 */
export async function authorize(min: Role): Promise<{ user: CurrentUser } | { denied: { error: string } }> {
  try {
    return { user: await requireRole(min) };
  } catch (e) {
    if (e instanceof PermissionError) return { denied: { error: e.message } };
    throw e;
  }
}
