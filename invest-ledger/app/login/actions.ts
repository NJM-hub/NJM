"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth";
import { db } from "@/lib/supabase";
import type { FormState } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** 로그인 후 돌아갈 주소 (다른 사이트로 튀지 않게 내부 주소만 허용) */
function safeNext(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") && !v.startsWith("/setup") ? v : "/";
}

/** Supabase 에 이메일·비밀번호가 맞는지 확인하고 사용자 id 를 돌려준다 */
async function checkPassword(email: string, password: string): Promise<string | null> {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return data.user.id;
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };

  const userId = await checkPassword(email, password);
  if (!userId) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };

  const supabase = db();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, session_version")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { error: "이 장부에 등록되지 않은 계정입니다. 관리자에게 문의하세요." };
  if (!profile.is_active) return { error: "사용이 중지된 계정입니다. 관리자에게 문의하세요." };

  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
  await startSession(userId, profile.session_version, fd.get("keep") === "on");
  redirect(safeNext(str(fd, "next")));
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 처음 한 번: 관리자 계정 만들기 (기존 접속 비밀번호로 본인 확인) */
export async function setupAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = db();
  const { count, error: countError } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  if (countError) return { error: `DB 확인 실패: ${countError.message}` };
  if ((count ?? 0) > 0) return { error: "이미 관리자 계정이 있습니다. 로그인 화면에서 로그인하세요." };

  const setupPassword = process.env.BASIC_AUTH_PASSWORD;
  if (!setupPassword) return { error: "Vercel 환경변수 BASIC_AUTH_PASSWORD 가 없어 본인 확인을 할 수 없습니다." };
  if (!sameSecret(String(fd.get("setup_password") ?? ""), setupPassword)) {
    return { fieldErrors: { setup_password: "접속 비밀번호가 맞지 않습니다. (지금까지 사이트에 들어갈 때 쓰던 비밀번호)" } };
  }

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "이름을 입력하세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "이메일 형식이 올바르지 않습니다.";
  if (password.length < 8) fieldErrors.password = "비밀번호는 8자 이상으로 정하세요.";
  if (password !== String(fd.get("password2") ?? "")) fieldErrors.password2 = "비밀번호 확인이 일치하지 않습니다.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  let userId: string | null = null;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    // 이전에 만들다 멈춘 경우: 같은 비밀번호면 그 계정을 이어서 사용
    userId = await checkPassword(email, password);
    if (!userId) return { error: `계정을 만들지 못했습니다: ${error.message}` };
  } else {
    userId = data.user.id;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, email, display_name: name, role: "admin" });
  if (profileError) return { error: `관리자 정보를 저장하지 못했습니다: ${profileError.message}` };

  await startSession(userId, 1, false);
  redirect("/");
}
