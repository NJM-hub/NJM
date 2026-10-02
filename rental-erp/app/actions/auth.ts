"use server";

import { redirect } from "next/navigation";
import { authorize, endSession, requireUser, startSession } from "@/lib/auth";
import { audit, q, q1 } from "@/lib/db";
import { FormReader } from "@/lib/form";
import { hashPassword, sameSecret, verifyPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import type { FormState } from "@/lib/types";

function safeNext(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") && !v.startsWith("/setup") ? v : "/";
}

// 로그인 시도 제한 (같은 서버 인스턴스 기준, 이메일별 10분에 10회)
const attempts = new Map<string, { n: number; at: number }>();

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };

  const a = attempts.get(email);
  if (a && Date.now() - a.at < 10 * 60 * 1000 && a.n >= 10) return { error: "로그인 시도가 너무 많습니다. 10분 뒤 다시 시도하세요." };

  const u = await q1<{ id: string; password_hash: string; is_active: boolean; session_version: number }>(
    "select id, password_hash, is_active, session_version from users where email = $1",
    [email],
  );
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    attempts.set(email, { n: (a && Date.now() - a.at < 10 * 60 * 1000 ? a.n : 0) + 1, at: a?.at && Date.now() - a.at < 10 * 60 * 1000 ? a.at : Date.now() });
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (!u.is_active) return { error: "사용이 중지된 계정입니다. 관리자에게 문의하세요." };
  attempts.delete(email);
  await q("update users set last_login_at = now() where id = $1", [u.id]);
  await startSession(u.id, u.session_version, fd.get("keep") === "on");
  redirect(safeNext(String(fd.get("next") ?? "/")));
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/** 처음 한 번: 관리자 계정 만들기 */
export async function setupAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const count = await q1<{ n: number }>("select count(*)::int as n from users");
  if ((count?.n ?? 0) > 0) return { error: "이미 관리자 계정이 있습니다. 로그인 화면에서 로그인하세요." };

  const setupPassword = process.env.SETUP_PASSWORD;
  if (!setupPassword) return { error: "환경변수 SETUP_PASSWORD 가 없어 본인 확인을 할 수 없습니다. Vercel 에 추가한 뒤 다시 배포하세요." };
  if (!sameSecret(String(fd.get("setup_password") ?? ""), setupPassword)) {
    return { fieldErrors: { setup_password: "설치 비밀번호(SETUP_PASSWORD)가 맞지 않습니다." } };
  }
  const f = new FormReader(fd);
  const name = f.text("name", { required: "이름을 입력하세요." });
  const email = (f.text("email", { required: "이메일을 입력하세요." }) ?? "").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.errors.email = "이메일 형식이 올바르지 않습니다.";
  if (password.length < 8) f.errors.password = "비밀번호는 8자 이상으로 정하세요.";
  if (password !== String(fd.get("password2") ?? "")) f.errors.password2 = "비밀번호 확인이 일치하지 않습니다.";
  if (!f.ok) return f.fail();

  const row = await q1<{ id: string }>(
    "insert into users (email, name, role, password_hash) values ($1, $2, 'admin', $3) returning id",
    [email, name, await hashPassword(password)],
  );
  await audit(row!.id, "create", "user", row!.id, { role: "admin", setup: true });
  await startSession(row!.id, 1, false);
  redirect("/settings?welcome=1");
}

/** 관리자: 사용자 추가 */
export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const f = new FormReader(fd);
  const name = f.text("name", { required: "이름을 입력하세요." });
  const email = (f.text("email", { required: "이메일을 입력하세요." }) ?? "").toLowerCase();
  const role = String(fd.get("role") ?? "");
  const password = String(fd.get("password") ?? "");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.errors.email = "이메일 형식이 올바르지 않습니다.";
  if (!isRole(role)) f.errors.role = "권한을 선택하세요.";
  if (password.length < 8) f.errors.password = "처음 비밀번호는 8자 이상";
  if (!f.ok) return f.fail();
  const dup = await q1("select 1 from users where email = $1", [email]);
  if (dup) return { fieldErrors: { email: "이미 등록된 이메일입니다." } };
  const row = await q1<{ id: string }>("insert into users (email, name, role, password_hash) values ($1,$2,$3,$4) returning id", [
    email,
    name,
    role,
    await hashPassword(password),
  ]);
  await audit(a.user.id, "create", "user", row!.id, { email, role });
  return { ok: `${name} 계정을 만들었습니다. 이메일과 처음 비밀번호를 전달하세요.` };
}

/** 관리자: 권한 변경 / 사용 중지 / 비밀번호 재설정 */
export async function updateUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "");
  const active = fd.get("is_active") === "on";
  const password = String(fd.get("password") ?? "");
  if (!isRole(role)) return { error: "권한을 선택하세요." };
  if (id === a.user.id && (role !== "admin" || !active)) return { error: "본인 계정의 관리자 권한은 해제할 수 없습니다." };
  if (password && password.length < 8) return { error: "새 비밀번호는 8자 이상" };
  await q(
    `update users set role = $2, is_active = $3,
       password_hash = case when $4 = '' then password_hash else $4 end,
       session_version = session_version + case when $4 = '' and is_active = $3 then 0 else 1 end
     where id = $1`,
    [id, role, active, password ? await hashPassword(password) : ""],
  );
  await audit(a.user.id, "update", "user", id, { role, active, passwordReset: !!password });
  return { ok: "저장했습니다." };
}

/** 내 비밀번호 변경 */
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const cur = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const u = await q1<{ password_hash: string; session_version: number }>("select password_hash, session_version from users where id = $1", [me.id]);
  if (!u || !(await verifyPassword(cur, u.password_hash))) return { fieldErrors: { current: "현재 비밀번호가 맞지 않습니다." } };
  if (next.length < 8) return { fieldErrors: { password: "8자 이상" } };
  if (next !== String(fd.get("password2") ?? "")) return { fieldErrors: { password2: "확인이 일치하지 않습니다." } };
  await q("update users set password_hash = $2, session_version = session_version + 1 where id = $1", [me.id, await hashPassword(next)]);
  await startSession(me.id, u.session_version + 1, false);
  return { ok: "비밀번호를 바꿨습니다. 다른 기기의 로그인은 모두 끊겼습니다." };
}
