import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트.
 * 비밀키(SUPABASE_SECRET_KEY)를 쓰므로 브라우저 코드에서는 절대 import 하지 마세요.
 * ("server-only" 덕분에 실수로 import 하면 빌드가 실패합니다)
 */
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("환경변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY 를 설정하세요. (README 참고)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
