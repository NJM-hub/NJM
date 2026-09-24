"use server";
import { createAdminClient } from "@/lib/supabase/server";

export type SignupResult = { ok: true } | { ok: false; error: string };

/**
 * 인증 메일 없이 가입시킨다 (Supabase 무료 플랜 메일 발송 한도 회피).
 * 기사는 관리자 승인 전에는 배차를 받을 수 없으므로 메일 인증을 생략해도 된다.
 */
export async function signUpWithoutEmail(email: string, password: string): Promise<SignupResult> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: "이메일 형식을 확인하세요." };
  if (password.length < 8) return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };

  const { error } = await createAdminClient().auth.admin.createUser({ email: e, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { ok: false, error: "이미 가입된 이메일입니다. 로그인해주세요." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
