import "server-only";
import { db } from "@/lib/supabase";

/** 로그인 기능 준비 상태: SQL(0002) 실행 여부, 사용자 수. 연결 문제는 오류 대신 안내 문구로 돌려준다 */
export async function setupState(): Promise<{ migrated: boolean; userCount: number; error?: string }> {
  try {
    const { count, error } = await db().from("profiles").select("session_version", { count: "exact", head: false }).limit(1);
    if (error) {
      const missing = /session_version|column/i.test(error.message);
      if (!missing && /relation|does not exist|schema cache|Could not find/i.test(error.message)) {
        return { migrated: false, userCount: 0, error: "DB 표가 아직 없습니다. Supabase SQL Editor 에서 supabase/setup_all.sql 을 실행하세요." };
      }
      if (/Invalid API key|JWT|apikey|401/i.test(error.message)) {
        return { migrated: false, userCount: 0, error: "Supabase 키가 맞지 않습니다. Vercel 의 SUPABASE_SERVICE_ROLE_KEY 값(Secret 또는 service_role 키)을 확인하세요." };
      }
      return { migrated: !missing, userCount: 0, error: missing ? undefined : error.message };
    }
    return { migrated: true, userCount: count ?? 0 };
  } catch (e) {
    // 환경변수 누락, 잘못된 주소 등 (값은 보여주지 않고 이름만 안내)
    const msg = (e as Error).message || String(e);
    if (/fetch failed|ENOTFOUND|Invalid URL|getaddrinfo/i.test(msg)) {
      return { migrated: false, userCount: 0, error: "Supabase 주소에 연결할 수 없습니다. Vercel 의 NEXT_PUBLIC_SUPABASE_URL 값(https://….supabase.co)을 확인하세요." };
    }
    return { migrated: false, userCount: 0, error: msg };
  }
}
