import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { q1 } from "@/lib/db";

/** 문서 보기/내려받기 (로그인 사용자) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "없음" }, { status: 404 });
  const d = await q1<{ file_name: string; mime_type: string; data: Buffer }>("select file_name, mime_type, data from documents where id = $1", [id]);
  if (!d) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(d.data), {
    headers: {
      "content-type": d.mime_type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.file_name)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=300",
    },
  });
}
