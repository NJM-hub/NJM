import { NextResponse, type NextRequest } from "next/server";
import { autoConfirmPastRuns } from "@/lib/dispatch/confirm";
import { todayKst } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 매일 밤 12시(KST)에 Vercel Cron 이 부른다.
 * 날짜가 지났는데 확정하지 않은 배차(초안)를 자동으로 확정해서 차량별 정산·외부 콜·정산표에 반영되게 한다.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("권한이 없습니다.", { status: 401 });
  }
  try {
    const confirmed = await autoConfirmPastRuns(createAdminClient(), todayKst());
    return NextResponse.json({ ok: true, today: todayKst(), confirmed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
