import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * 서버 전용 Supabase 클라이언트.
 * service_role 키는 브라우저로 절대 전달되지 않습니다 ("server-only" 가 실수로 import 되는 것을 막아줌).
 */
export function db() {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
