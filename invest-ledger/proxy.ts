import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// 로그인 없이 열 수 있는 화면
const PUBLIC = ["/login", "/setup"];

/**
 * 모든 요청에서 로그인 쿠키(서명·만료)를 확인하고, 없으면 로그인 화면으로 보낸다.
 * 계정 중지·비밀번호 변경 여부는 각 화면에서 DB 로 한 번 더 확인한다 (lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (session) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
