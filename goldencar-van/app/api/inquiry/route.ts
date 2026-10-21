import { deliverInquiry } from "@/lib/deliver";
import { parseInquiry, validateInquiry } from "@/lib/inquiry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: "bad_request", message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 스팸 방지용 숨은 칸: 사람은 비워 두고, 자동 프로그램은 채웁니다.
  if (body && typeof body === "object" && (body as Record<string, unknown>).website) {
    return Response.json({ ok: false, code: "bad_request", message: "요청을 처리할 수 없습니다." }, { status: 400 });
  }

  const input = parseInquiry(body);
  if (!input) {
    return Response.json({ ok: false, code: "bad_request", message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const errors = validateInquiry(input);
  if (Object.keys(errors).length > 0) {
    return Response.json({ ok: false, code: "invalid", errors, message: "입력 내용을 다시 확인해 주세요." }, { status: 422 });
  }

  const result = await deliverInquiry(input);
  if (result.ok) return Response.json({ ok: true });
  if (result.reason === "not_configured") {
    return Response.json(
      { ok: false, code: "not_configured", message: "온라인 접수가 아직 연결되지 않았습니다." },
      { status: 503 },
    );
  }
  return Response.json(
    { ok: false, code: "failed", message: "문의를 보내는 중 문제가 생겼습니다. 잠시 후 다시 시도하거나 전화로 문의해 주세요." },
    { status: 502 },
  );
}
