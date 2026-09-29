import "server-only";
import { db } from "@/lib/supabase";

export type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await db()
    .from("profiles")
    .select("id, email, display_name, role, is_active, last_login_at, created_at")
    .order("created_at");
  if (error) throw new Error(`사용자 조회 중 오류: ${error.message}`);
  return data ?? [];
}

export async function getUser(id: string): Promise<UserRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db()
    .from("profiles")
    .select("id, email, display_name, role, is_active, last_login_at, created_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** 사용자 id → 이름 (변경 이력 표시용) */
export async function userNames(): Promise<Record<string, string>> {
  const { data } = await db().from("profiles").select("id, display_name, email");
  return Object.fromEntries((data ?? []).map((u) => [u.id, u.display_name || u.email]));
}
