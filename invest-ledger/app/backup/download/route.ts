import { getCurrentUser } from "@/lib/auth";
import { buildBackupXlsx } from "@/lib/backup";
import { todayKst } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 장부 전체 백업 (엑셀) — 관리자만 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  if (user.role !== "admin") return new Response("관리자만 백업을 받을 수 있습니다.", { status: 403 });

  const buf = await buildBackupXlsx();
  const name = `투자장부_백업_${todayKst()}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup_${todayKst()}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
