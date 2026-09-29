"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, requireUser, startSession } from "@/lib/auth";
import { isRole } from "@/lib/permissions";
import { db } from "@/lib/supabase";
import type { FormState } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordErrors(fd: FormData, key = "password"): Record<string, string> {
  const p = String(fd.get(key) ?? "");
  if (p.length < 8) return { [key]: "비밀번호는 8자 이상으로 정하세요." };
  if (p !== String(fd.get(`${key}2`) ?? "")) return { [`${key}2`]: "비밀번호 확인이 일치하지 않습니다." };
  return {};
}

/** 활성 관리자가 한 명 이상 남는지 (자기 자신을 마지막 관리자에서 빼는 사고 방지) */
async function otherActiveAdmins(exceptId: string): Promise<number> {
  const { count } = await db()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", exceptId);
  return count ?? 0;
}

/** 사용자 추가 (관리자) */
export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  const fieldErrors: Record<string, string> = { ...passwordErrors(fd) };
  if (!name) fieldErrors.name = "이름을 입력하세요.";
  if (!EMAIL.test(email)) fieldErrors.email = "이메일 형식이 올바르지 않습니다.";
  if (!isRole(role)) fieldErrors.role = "권한을 선택하세요.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = db(a.user.id);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: String(fd.get("password")),
    email_confirm: true,
  });
  if (error) {
    return /already|registered|exists/i.test(error.message)
      ? { fieldErrors: { email: "이미 등록된 이메일입니다." } }
      : { error: `계정을 만들지 못했습니다: ${error.message}` };
  }
  const { error: pErr } = await supabase.from("profiles").insert({ id: data.user.id, email, display_name: name, role });
  if (pErr) return { error: `사용자 정보를 저장하지 못했습니다: ${pErr.message}` };

  revalidatePath("/users");
  redirect("/users?msg=created");
}

/** 이름·권한·사용 여부 변경 (관리자) */
export async function updateUserAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;

  const name = str(fd, "name");
  const role = str(fd, "role");
  const active = fd.get("is_active") === "on";
  if (!name) return { fieldErrors: { name: "이름을 입력하세요." } };
  if (!isRole(role)) return { fieldErrors: { role: "권한을 선택하세요." } };

  if (userId === a.user.id && (role !== "admin" || !active)) {
    return { error: "자기 자신의 관리자 권한을 빼거나 사용 중지할 수 없습니다. 다른 관리자에게 부탁하세요." };
  }
  if ((role !== "admin" || !active) && (await otherActiveAdmins(userId)) === 0) {
    const { data: target } = await db().from("profiles").select("role, is_active").eq("id", userId).single();
    if (target?.role === "admin" && target.is_active) return { error: "마지막 관리자는 바꿀 수 없습니다. 먼저 다른 관리자를 만드세요." };
  }

  const { error } = await db(a.user.id).from("profiles").update({ display_name: name, role, is_active: active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/users/${userId}?msg=saved`);
}

/** 비밀번호 재설정 (관리자가 직원 비밀번호를 새로 정해줌) → 그 사용자는 다시 로그인해야 함 */
export async function resetPasswordAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const a = await authorize("admin");
  if ("denied" in a) return a.denied;
  const fieldErrors = passwordErrors(fd);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = db(a.user.id);
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: String(fd.get("password")) });
  if (error) return { error: `비밀번호를 바꾸지 못했습니다: ${error.message}` };
  await bumpSession(userId);
  if (userId === a.user.id) redirect("/login");
  redirect(`/users/${userId}?msg=password`);
}

async function bumpSession(userId: string): Promise<number> {
  const supabase = db();
  const { data } = await supabase.from("profiles").select("session_version").eq("id", userId).single();
  const next = (data?.session_version ?? 1) + 1;
  await supabase.from("profiles").update({ session_version: next }).eq("id", userId);
  return next;
}

/** 내 비밀번호 변경 (현재 비밀번호 확인). 다른 기기의 로그인은 모두 끊긴다 */
export async function changeOwnPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(fd.get("current") ?? "");
  const fieldErrors = passwordErrors(fd);
  if (!current) fieldErrors.current = "현재 비밀번호를 입력하세요.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = db(me.id);
  const { error: signErr } = await supabase.auth.signInWithPassword({ email: me.email, password: current });
  if (signErr) return { fieldErrors: { current: "현재 비밀번호가 맞지 않습니다." } };
  const { error } = await supabase.auth.admin.updateUserById(me.id, { password: String(fd.get("password")) });
  if (error) return { error: `비밀번호를 바꾸지 못했습니다: ${error.message}` };

  const version = await bumpSession(me.id);
  await startSession(me.id, version, false);
  redirect("/account?msg=password");
}

/** 내 이름 변경 */
export async function updateOwnNameAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const name = str(fd, "name");
  if (!name) return { fieldErrors: { name: "이름을 입력하세요." } };
  const { error } = await db(me.id).from("profiles").update({ display_name: name }).eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/account?msg=saved");
}
