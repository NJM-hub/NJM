import "server-only";
import { createClient } from "@supabase/supabase-js";

/** 비로그인 방문자용 읽기 전용 클라이언트 (RLS: 공개 데이터만). 환경변수가 없으면 null. */
export function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}
