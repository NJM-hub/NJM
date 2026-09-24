import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { UNASSIGNED_REASON_LABEL, type UnassignedReason } from "@/lib/dispatch/algorithm";
import { fmtTime } from "@/lib/format";
import { toCsv } from "@/lib/tax";

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const runId = request.nextUrl.searchParams.get("run");
  if (!runId) return new NextResponse("run 파라미터가 필요합니다.", { status: 400 });

  const { data: run } = await s.supabase.from("dispatch_runs").select("service_date,status").eq("id", runId).single();
  if (!run) return new NextResponse("배차를 찾을 수 없습니다.", { status: 404 });
  const { data } = await s.supabase
    .from("dispatch_assignments")
    .select("seq,deadhead_km,unassigned_reason,fare,vehicles(plate_number),drivers(name,phone),bookings(booking_no,pickup_at,product_name,customer_name,customer_phone,pax,pickup_address,dropoff_address,flight_no,memo,pickup_place,dropoff_place)")
    .eq("run_id", runId);

  type Row = {
    seq: number | null; deadhead_km: number | null; unassigned_reason: string | null; fare: number;
    vehicles: { plate_number: string } | null; drivers: { name: string; phone: string } | null;
    bookings: { booking_no: string | null; pickup_at: string | null; product_name: string | null; customer_name: string | null; customer_phone: string | null; pax: number; pickup_address: string | null; dropoff_address: string | null; flight_no: string | null; memo: string | null; pickup_place: string | null; dropoff_place: string | null };
  };
  const rows = ((data ?? []) as unknown as Row[]).sort(
    (a, b) =>
      (a.vehicles?.plate_number ?? "~").localeCompare(b.vehicles?.plate_number ?? "~") ||
      (a.bookings.pickup_at ?? "").localeCompare(b.bookings.pickup_at ?? ""),
  );

  const csv = toCsv([
    ["이용일", "차량", "기사", "기사연락처", "순번", "픽업시간", "예약번호", "상품", "고객", "고객연락처", "인원", "픽업장소", "픽업주소", "하차장소", "하차주소", "항공편", "메모", "공차이동(km)", "기사지급액", "배차불가사유"],
    ...rows.map((r) => [
      run.service_date, r.vehicles?.plate_number ?? "", r.drivers?.name ?? "", r.drivers?.phone ?? "", r.seq ?? "",
      fmtTime(r.bookings.pickup_at), r.bookings.booking_no, r.bookings.product_name, r.bookings.customer_name, r.bookings.customer_phone,
      r.bookings.pax, r.bookings.pickup_place, r.bookings.pickup_address, r.bookings.dropoff_place, r.bookings.dropoff_address, r.bookings.flight_no, r.bookings.memo,
      r.deadhead_km != null ? r.deadhead_km.toFixed(1) : "", r.vehicles ? r.fare : "",
      r.unassigned_reason ? UNASSIGNED_REASON_LABEL[r.unassigned_reason as UnassignedReason] ?? "수동 해제" : "",
    ]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`배차표_${run.service_date}.csv`)}`,
    },
  });
}
