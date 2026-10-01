/**
 * 화면에 보이는 회사 이름 (로그인 화면, 메뉴 위쪽, 브라우저 탭).
 * 사이트마다 다르게 하려면 Vercel 환경변수 NEXT_PUBLIC_APP_NAME 에 이름을 넣고 다시 배포하세요.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "(주)우정파트너스";
