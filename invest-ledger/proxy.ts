import { NextResponse, type NextRequest } from "next/server";

/**
 * 임시 접속 보호 (5단계 로그인 기능 전까지 사용)
 * 사이트에 들어오면 브라우저가 아이디/비밀번호를 묻고,
 * 환경변수 BASIC_AUTH_USER / BASIC_AUTH_PASSWORD 와 같을 때만 통과시킨다.
 */
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER || "admin";
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!password) {
    // 내 컴퓨터(개발 모드)에서는 비밀번호 없이 허용, 배포 사이트에서는 설정할 때까지 차단
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("BASIC_AUTH_PASSWORD 환경변수를 설정해야 사이트를 열 수 있습니다. (README 참고)", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (u === user && rest.join(":") === password) return NextResponse.next();
    } catch {
      // 잘못된 헤더는 아래에서 다시 비밀번호를 묻는다
    }
  }

  return new NextResponse("로그인이 필요합니다.", {
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
