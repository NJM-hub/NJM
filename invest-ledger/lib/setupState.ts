import "server-only";
import { db } from "@/lib/supabase";

/** 로그인 기능 준비 상태: SQL(0002) 실행 여부, 사용자 수 */
export async function setupState(): Promise<{ migrated: boolean; userCount: number; error?: string }> {
  const { count, error } = await db().from("profiles").select("session_version", { count: "exact", head: false }).limit(1);
  if (error) {
    const missing = /session_version|column/i.test(error.message);
    return { migrated: !missing, userCount: 0, error: missing ? undefined : error.message };
  }
  return { migrated: true, userCount: count ?? 0 };
}
