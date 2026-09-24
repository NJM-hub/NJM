/** 홈페이지 기본 주소. NEXT_PUBLIC_SITE_URL(직접 지정) → Vercel 운영 도메인 → 로컬 순서. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
