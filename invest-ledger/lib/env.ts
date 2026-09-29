function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. README 의 "설치하기"를 확인하세요.`);
  }
  return value.trim();
}

// Vercel 에서 Supabase 를 연결하면 아래 이름들이 자동으로 들어온다 (새/옛 이름 모두 지원)
export const env = {
  // 주소 끝에 /rest/v1/ 이나 / 를 붙여 넣어도 동작하도록 정리
  supabaseUrl: () =>
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/+$/, ""),
  serviceRoleKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
};
