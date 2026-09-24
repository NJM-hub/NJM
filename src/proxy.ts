import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 로그인이 필요한 영역. 나머지(홈페이지·로그인·가입)는 공개.
const PROTECTED_PATHS = ["/admin", "/driver", "/me", "/mypage"];

/** Supabase 세션 쿠키 갱신 + 비로그인 사용자가 관리 화면에 들어오면 로그인 페이지로 이동 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!user && isProtected) {
    const login = request.nextUrl.clone();
    // 홈페이지 고객은 고객 로그인으로, 나머지는 직원 로그인으로
    login.pathname = path.startsWith("/mypage") ? "/signin" : "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
