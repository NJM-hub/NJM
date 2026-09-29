import { NextResponse, type NextRequest } from "next/server";

/**
 * 사이트 전체 비밀번호 보호 (HTTP 기본 인증)
 * 5단계에서 정식 로그인(Supabase Auth)으로 바뀌기 전까지 사용합니다.
 * 환경변수 ADMIN_USER / ADMIN_PASSWORD 로 아이디와 비밀번호를 정합니다.
 */
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    // 내 컴퓨터(개발 모드)에서는 비밀번호 없이도 열어줌
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("ADMIN_PASSWORD 환경변수를 설정해야 사이트를 열 수 있습니다.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
      const sep = decoded.indexOf(":");
      if (sep >= 0 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      // 잘못된 형식 → 아래에서 다시 요청
    }
  }

  return new NextResponse("아이디와 비밀번호가 필요합니다.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="invest-ledger", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
