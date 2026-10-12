import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBackup } from "@/lib/backup";
import { APP_NAME } from "@/lib/brand";
import { todayKST } from "@/lib/dates";
import { audit } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 전체 백업 파일 다운로드 (관리자) */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ error: "관리자만 백업을 받을 수 있습니다." }, { status: 403 });
  const { buf, counts } = await createBackup();
  await audit(u.id, "download", "backup", null, { bytes: buf.length, counts });
  const name = `${APP_NAME}_백업_${todayKST()}.json.gz`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="rental-backup-${todayKST()}.json.gz"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}
