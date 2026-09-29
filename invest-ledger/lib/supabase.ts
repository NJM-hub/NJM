import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * 서버 전용 Supabase 클라이언트.
 * service_role 키는 브라우저로 절대 전달되지 않습니다 ("server-only" 가 실수로 import 되는 것을 막아줌).
 *
 * actorId 를 넘기면 DB 가 등록자(created_by)와 변경 이력(audit_logs.actor)에 그 사용자를 기록합니다.
 */
export function db(actorId?: string) {
  return createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: actorId ? { headers: { "x-actor-id": actorId } } : undefined,
  });
}
