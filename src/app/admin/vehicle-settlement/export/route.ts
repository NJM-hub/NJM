import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { fmtTime, isMonth } from "@/lib/format";
import { loadVehicleMonth } from "@/lib/settlement/vehicleMonthlyLoad";
import { EXPENSE_LABELS, inOutLabel, OWN_CALL } from "@/lib/settlement/vehicleMonthly";
import { toCsv } from "@/lib/tax";

/**
 * v 가 있으면 그 차량의 정산표(기존 엑셀 정산 양식: 건별 내역 → 금액 합계 → 비용 → 차액·세액·지급액),
 * 없으면 전체 차량 요약. 엑셀에서 바로 열리는 CSV.
 */
export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const month = request.nextUrl.searchParams.get("month");
  const only = request.nextUrl.searchParams.get("v");
  if (!isMonth(month)) return new NextResponse("month=YYYY-MM 이 필요합니다.", { status: 400 });

  const report = await loadVehicleMonth(s.supabase, month);
  const mon = Number(month.slice(5));
  let rows: unknown[][];
  let name: string;

  const v = only ? report.vehicles.find((x) => x.vehicleId === only) : undefined;
  if (only && !v) return new NextResponse("해당 차량의 확정 배차가 없습니다.", { status: 404 });

  if (v) {
    const driver = [v.driverName, v.plate].filter(Boolean).join(" ");
    rows = [
      [`${report.companyName ?? ""} ${mon}월`.trim()],
      ["예약번호", "항공편", "인아웃", "진행일", "시간", "진행자", "차량스펙", "인원", "비고", "금액"],
      ...v.rows.map((r) => {
        const own = r.source === OWN_CALL;
        return [
          own ? "외부오더" : r.bookingNo, r.flightNo, inOutLabel(r), r.serviceDate, r.pickupAt ? fmtTime(r.pickupAt) : "",
          driver, r.vehicleClass, own ? "" : r.pax, r.memo, r.amount,
        ];
      }),
      [],
      ["금액 합계", "", "", "", "", "", "", "", "", v.payout.amount],
      [],
      ...(Object.keys(EXPENSE_LABELS) as (keyof typeof EXPENSE_LABELS)[]).map((k) => [EXPENSE_LABELS[k], "", "", "", "", "", "", "", "", v.expenses?.[k] ?? 0]),
      ["비용 합계", "", "", "", "", "", "", "", v.expenses?.memo ?? "", v.payout.expenses],
      ["차액", "", "", "", "", "", "", "", "", v.payout.diff],
      ["세액", "", "", "", "", "", "", "", `소득세 ${v.payout.incomeTax} + 지방소득세 ${v.payout.localTax}`, v.payout.tax],
      ["지급액", "", "", "", "", "", "", "", "", v.payout.pay],
      [],
      ["날짜별 건수"],
      ["날짜", "픽업", "샌딩", "기타", "합계", "외부오더", "금액"],
      ...v.days.map((d) => [d.date, d.pickup, d.sending, d.other, d.pickup + d.sending + d.other, d.own, d.amount]),
      [`${mon}월 합계`, v.total.pickup, v.total.sending, v.total.other, v.total.calls, v.total.own, v.total.amount],
    ];
    name = `${mon}월_정산_${v.plate}${v.driverName ? `_${v.driverName}` : ""}.csv`;
  } else {
    rows = [
      ["차량", "기사", "운행일", "픽업", "샌딩", "기타", "합계", "외부오더", "금액 합계", ...Object.values(EXPENSE_LABELS), "비용 합계", "차액", "세액", "지급액"],
      ...report.vehicles.map((x) => [
        x.plate, x.driverName ?? "", x.total.workDays, x.total.pickup, x.total.sending, x.total.other, x.total.calls, x.total.own,
        x.payout.amount, ...(Object.keys(EXPENSE_LABELS) as (keyof typeof EXPENSE_LABELS)[]).map((k) => x.expenses?.[k] ?? 0),
        x.payout.expenses, x.payout.diff, x.payout.tax, x.payout.pay,
      ]),
    ];
    name = `${mon}월_차량별_정산요약_${month}.csv`;
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
