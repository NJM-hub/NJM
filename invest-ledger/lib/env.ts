import "server-only";

/** 필요한 환경변수 중 빠진 것의 이름 목록 */
export function missingEnv(): string[] {
  return ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"].filter((k) => !process.env[k]);
}
