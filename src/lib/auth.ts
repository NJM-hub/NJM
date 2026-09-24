import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "driver";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, role: (profile?.role ?? "driver") as Role };
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin() {
  const s = await requireUser();
  if (s.role !== "admin") redirect("/driver");
  return s;
}

/** 서버 액션용: 리다이렉트 대신 에러 */
export async function assertAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
  return s;
}
