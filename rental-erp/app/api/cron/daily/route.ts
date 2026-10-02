import { NextResponse } from "next/server";
import { sameSecret } from "@/lib/password";
import { runDaily } from "@/lib/jobs";

/** Vercel Cron (vercel.json) 이 매일 아침 호출: 월세 자동 청구 + 알림 생성. CRON_SECRET 필요 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !sameSecret(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runDaily();
  return NextResponse.json({ ok: true, ...r });
}
