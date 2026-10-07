import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { fmtTime, isMonth, tripLabel } from "@/lib/format";
import { loadExternalCalls } from "@/lib/settlement/externalCalls";
import { toCsv } from "@/lib/tax";

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const month = request.nextUrl.searchParams.get("month");
  const type = request.nextUrl.searchParams.get("type") === "in" ? "in" : "out";
  if (!isMonth(month)) return new NextResponse("month=YYYY-MM 이 필요합니다.", { status: 400 });
  const { out, inCalls } = await loadExternalCalls(s.supabase, month);
  const t = (x: string | null) => tripLabel(x)?.label ?? "";

  const rows =
    type === "out"
      ? [
          ["날짜", "시간", "구분", "예약번호", "항공편", "차급", "인원", "출발", "도착", "KKday 정산(부가세 포함)", "부가세 제외", "준 금액", "차액"],
          ...out.map((c) => [c.date, c.pickupAt ? fmtTime(c.pickupAt) : "", t(c.tripType), c.bookingNo, c.flightNo, c.vehicleClass, c.pax, c.from, c.to, c.kkdayAmount ?? "-", c.kkdayNet ?? "-", c.fare, c.diff ?? "-"]),
        ]
      : [
          ["날짜", "시간", "차량", "기사", "구분", "내용", "시트 요금", "정산 금액", "입금"],
          ...inCalls.map((c) => [c.date, c.pickupAt ? fmtTime(c.pickupAt) : "", c.plate, c.driverName, t(c.tripType), c.content, c.charterFare ?? "", c.settleAmount, c.paid ? "확인" : ""]),
        ];
  const name = `${Number(month.slice(5))}월_${type === "out" ? "외부로_준_콜" : "외부에서_받은_콜"}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` },
  });
}
