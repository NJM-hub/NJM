import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = request.nextUrl.searchParams.get("next");
  const target = next === "/" ? "/" : "/login";
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), { status: 303 });
}
