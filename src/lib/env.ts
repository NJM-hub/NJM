function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. README 의 설정 방법을 확인하세요.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  piiKey: () => required("PII_ENCRYPTION_KEY", process.env.PII_ENCRYPTION_KEY),
  kakaoKey: () => process.env.KAKAO_REST_API_KEY || null,
};
