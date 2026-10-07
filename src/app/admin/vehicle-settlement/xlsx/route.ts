import { NextResponse, type NextRequest } from "next/server";
import writeXlsxFile, { type Sheet, type SheetData } from "write-excel-file/node";
import { getSession } from "@/lib/auth";
import { fmtTime, isMonth } from "@/lib/format";
import { EXPENSE_LABELS, inOutLabel, OWN_CALL } from "@/lib/settlement/vehicleMonthly";
import { loadVehicleMonth, type VehicleMonthReport } from "@/lib/settlement/vehicleMonthlyLoad";

const MONEY = "#,##0";
const HEAD = { fontWeight: "bold" as const, backgroundColor: "#E5E7EB" };
const money = (n: number, extra: object = {}) => ({ value: n, format: MONEY, ...extra });
const EXPENSE_KEYS = Object.keys(EXPENSE_LABELS) as (keyof typeof EXPENSE_LABELS)[];

type V = VehicleMonthReport["vehicles"][number];

const sheetName = (s: string, used: Set<string>) => {
  let name = s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "차량";
  for (let i = 2; used.has(name); i++) name = `${name.slice(0, 28)}(${i})`;
  used.add(name);
  return name;
};

/** 기존 엑셀 정산서 양식: 제목 → 건별 내역 → 금액 합계 → 비용 → 차액·세액·지급액 */
function vehicleSheet(report: VehicleMonthReport, v: V, used: Set<string>): Sheet<never> {
  const mon = Number(report.month.slice(5));
  const driver = [v.driverName, v.plate].filter(Boolean).join(" ");
  const p = v.payout;
  const data: SheetData = [
    [{ value: `${report.companyName ?? ""} ${mon}월 정산 — ${driver}`.trim(), fontWeight: "bold", fontSize: 14 }],
    ["예약번호", "항공편", "인아웃", "진행일", "시간", "진행자", "차량스펙", "인원", "비고", "금액"].map((h) => ({ value: h, ...HEAD })),
    ...v.rows.map((r) => {
      const own = r.source === OWN_CALL;
      return [
        own ? "외부오더" : r.bookingNo ?? "", r.flightNo ?? "", inOutLabel(r), r.serviceDate, r.pickupAt ? fmtTime(r.pickupAt) : "",
        r.operator ? `${r.operator} ${v.plate.slice(-4)}` : driver, r.vehicleClass ?? "", own ? null : r.pax ?? null, r.memo ?? "", money(r.amount, r.amount < 0 ? { textColor: "#DC2626" } : {}),
      ];
    }),
    [null, null, null, null, null, null, null, null, { value: `금액 합계 (${v.total.calls}건, 외부오더 제외)`, fontWeight: "bold" }, money(p.amount, { fontWeight: "bold" })],
    ...(v.total.own
      ? [[null, null, null, null, null, null, null, null, { value: `외부오더 ${v.total.own}건 · 별도 수금`, textColor: "#6D28D9" }, money(v.total.ownAmount, { textColor: "#6D28D9" })]]
      : []),
    [],
    [...EXPENSE_KEYS.map((k) => ({ value: EXPENSE_LABELS[k], ...HEAD })), { value: "비용 합계", ...HEAD }],
    [...EXPENSE_KEYS.map((k) => money(v.expenses?.[k] ?? 0)), money(p.expenses, { fontWeight: "bold" })],
    v.expenses?.memo ? [{ value: `비용 메모: ${v.expenses.memo}` }] : [],
    [],
    [{ value: "차액 (금액 합계 − 비용)", fontWeight: "bold" }, null, money(p.diff)],
    [{ value: "세액 3.3%", fontWeight: "bold" }, null, money(p.tax)],
    [{ value: "  소득세 3%" }, null, money(p.incomeTax)],
    [{ value: "  지방소득세 0.3%" }, null, money(p.localTax)],
    [{ value: "지급액", fontWeight: "bold" }, null, money(p.pay, { fontWeight: "bold", backgroundColor: "#FEF3C7" })],
    v.total.own ? [{ value: "외부오더 별도 수금 (지급에서 빼지 않음)", textColor: "#6D28D9" }, null, money(v.total.ownAmount, { textColor: "#6D28D9" })] : [],
    [],
    [{ value: v.status === "confirmed" ? "정산 확정" : "작성 중 (미확정)", textColor: v.status === "confirmed" ? "#15803D" : "#B45309" }],
  ];
  return {
    data,
    sheet: sheetName(v.driverName ? `${v.driverName} ${v.plate.slice(-4)}` : v.plate, used),
    columns: [{ width: 16 }, { width: 10 }, { width: 8 }, { width: 11 }, { width: 7 }, { width: 16 }, { width: 16 }, { width: 6 }, { width: 30 }, { width: 13 }],
  };
}

function summarySheet(report: VehicleMonthReport, used: Set<string>): Sheet<never> {
  const heads = ["차량", "기사", "상태", "운행일", "픽업", "샌딩", "외부오더", "금액 합계", ...EXPENSE_KEYS.map((k) => EXPENSE_LABELS[k]), "비용 합계", "차액", "세액", "지급액", "별도 수금"];
  const sum = (f: (v: V) => number) => report.vehicles.reduce((s, v) => s + f(v), 0);
  const data: SheetData = [
    [{ value: `${report.companyName ?? ""} ${Number(report.month.slice(5))}월 차량별 정산 요약`.trim(), fontWeight: "bold", fontSize: 14 }],
    heads.map((h) => ({ value: h, ...HEAD })),
    ...report.vehicles.map((v) => [
      v.plate, `${v.driverName ?? ""}${v.operator ? " (차량 빌려 운행)" : ""}`, v.status === "confirmed" ? "확정" : "작성 중", v.total.workDays, v.total.pickup, v.total.sending, v.total.own,
      money(v.payout.amount), ...EXPENSE_KEYS.map((k) => money(v.expenses?.[k] ?? 0)), money(v.payout.expenses),
      money(v.payout.diff), money(v.payout.tax), money(v.payout.pay, { fontWeight: "bold" }), money(v.total.ownAmount),
    ]),
    [
      { value: "합계", fontWeight: "bold" }, null, null, null, sum((v) => v.total.pickup), sum((v) => v.total.sending), sum((v) => v.total.own),
      money(sum((v) => v.payout.amount)), ...EXPENSE_KEYS.map((k) => money(sum((v) => v.expenses?.[k] ?? 0))), money(sum((v) => v.payout.expenses)),
      money(sum((v) => v.payout.diff)), money(sum((v) => v.payout.tax)), money(sum((v) => v.payout.pay), { fontWeight: "bold" }), money(sum((v) => v.total.ownAmount)),
    ],
  ];
  return { data, sheet: sheetName("요약", used), columns: heads.map((_, i) => ({ width: i < 2 ? 14 : 11 })) };
}

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const month = request.nextUrl.searchParams.get("month");
  const only = request.nextUrl.searchParams.get("v");
  if (!isMonth(month)) return new NextResponse("month=YYYY-MM 이 필요합니다.", { status: 400 });

  const report = await loadVehicleMonth(s.supabase, month);
  const mon = Number(month.slice(5));
  const used = new Set<string>();
  let sheets: Sheet<never>[];
  let name: string;
  if (only) {
    const v = report.vehicles.find((x) => x.key === only);
    if (!v) return new NextResponse("해당 차량의 정산 내역이 없습니다.", { status: 404 });
    sheets = [vehicleSheet(report, v, used)];
    name = `${mon}월_정산_${v.plate}${v.driverName ? `_${v.driverName}` : ""}.xlsx`;
  } else {
    if (!report.vehicles.length) return new NextResponse(`${mon}월 정산 내역이 없습니다.`, { status: 404 });
    sheets = [summarySheet(report, used), ...report.vehicles.map((v) => vehicleSheet(report, v, used))];
    name = `${mon}월_차량별_정산서_${month}.xlsx`;
  }

  const buf = (await writeXlsxFile(sheets).toBuffer()) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
