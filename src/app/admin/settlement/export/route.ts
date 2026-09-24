import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { fmtTime, isMonth } from "@/lib/format";
import { formatRrn } from "@/lib/pii";
import { loadSettings, withholdingOf } from "@/lib/settings";
import { computeSettlement } from "@/lib/settlement/compute";
import { toCsv } from "@/lib/tax";

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const month = request.nextUrl.searchParams.get("month");
  const type = request.nextUrl.searchParams.get("type") ?? "statement";
  if (!isMonth(month)) return new NextResponse("month=YYYY-MM 이 필요합니다.", { status: 400 });

  const settings = await loadSettings(s.supabase);
  const list = (await computeSettlement(s.supabase, month, withholdingOf(settings))).filter((d) => d.driverId);
  const [year, mon] = month.split("-");
  const rrn = (enc: string | null) => {
    const v = decrypt(enc);
    return v ? formatRrn(v) : "";
  };

  let rows: unknown[][];
  let name: string;
  if (type === "transfer") {
    name = `기사지급_이체목록_${month}.csv`;
    rows = [
      ["은행", "계좌번호", "예금주", "이체금액", "기사명", "연락처", "메모"],
      ...list.map((d) => [d.bankName, decrypt(d.bankAccountEnc) ?? "", d.accountHolder, d.net, d.name, d.phone, `${mon}월 운행 ${d.calls}콜`]),
    ];
  } else if (type === "detail") {
    name = `운행내역_${month}.csv`;
    rows = [
      ["기사", "이용일", "픽업시간", "차량", "예약번호", "상품", "지급액"],
      ...list.flatMap((d) => d.items.map((it) => [d.name, it.date, fmtTime(it.pickupAt), it.plate, it.bookingNo, it.product, it.fare])),
    ];
  } else {
    // 거주자의 사업소득 간이지급명세서 작성용 (홈택스 직접 작성/엑셀 변환용)
    name = `사업소득_간이지급명세서_${month}.csv`;
    rows = [
      ["귀속연도", "지급월", "업종코드", "성명", "주민등록번호", "내외국인", "지급액", "세율(%)", "소득세", "지방소득세", "차인지급액", "건수", "지급자상호", "지급자사업자번호"],
      ...list.map((d) => [
        year, mon, settings.business_code, d.name, rrn(d.rrnEnc), "1(내국인)", d.gross,
        Math.round(settings.income_tax_rate * 1000) / 10, d.incomeTax, d.localTax, d.net, d.calls,
        settings.company_name ?? "", settings.company_brn ?? "",
      ]),
    ];
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
