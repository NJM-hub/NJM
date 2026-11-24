"use server";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { ok: boolean; message: string } | null;

/** 로그인한 사용자 본인 비밀번호 변경: 현재 비밀번호를 확인한 뒤 새 비밀번호로 바꾼다 */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8) return { ok: false, message: "새 비밀번호는 8자 이상이어야 합니다." };
  if (next !== confirm) return { ok: false, message: "새 비밀번호와 확인이 다릅니다." };
  if (next === current) return { ok: false, message: "새 비밀번호가 현재 비밀번호와 같습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "로그인이 필요합니다." };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (signInError) return { ok: false, message: "현재 비밀번호가 올바르지 않습니다." };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요." };
}
