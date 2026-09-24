import { requireAdmin } from "@/lib/auth";
import { isMonth, todayKst, won } from "@/lib/format";
import { loadSettings, withholdingOf } from "@/lib/settings";
import { computeSettlement } from "@/lib/settlement/compute";
import { filingDeadlines } from "@/lib/tax";

function prevMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export default async function SettlementPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : prevMonth(todayKst());
  const { supabase } = await requireAdmin();
  const settings = await loadSettings(supabase);
  const list = await computeSettlement(supabase, month, withholdingOf(settings));
  const total = list.reduce(
    (s, d) => ({ calls: s.calls + d.calls, gross: s.gross + d.gross, incomeTax: s.incomeTax + d.incomeTax, localTax: s.localTax + d.localTax, net: s.net + d.net }),
    { calls: 0, gross: 0, incomeTax: 0, localTax: 0, net: 0 },
  );
  const deadlines = filingDeadlines(month);
  const missing = list.filter((d) => !d.driverId || !d.rrnEnc || !d.bankAccountEnc);
  const q = `month=${month}`;

  return (
    <div className="space-y-6">
      <h1 className="page-title">정산 · 세무신고</h1>
      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="month">귀속(지급) 월</label>
          <input id="month" type="month" name="month" defaultValue={month} className="input" />
        </div>
        <button className="btn-secondary">조회</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn" href={`/admin/settlement/export?${q}&type=statement`}>간이지급명세서 자료</a>
          <a className="btn-secondary" href={`/admin/settlement/export?${q}&type=transfer`}>이체 목록</a>
          <a className="btn-secondary" href={`/admin/settlement/export?${q}&type=detail`}>건별 내역</a>
        </div>
      </form>

      <div className="card grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <div className="font-semibold">신고 일정 ({month} 지급분)</div>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            <li>원천세 신고·납부 (홈택스 원천징수이행상황신고서): <b>{deadlines.withholdingReturn}</b>까지</li>
            <li>사업소득 간이지급명세서 제출: <b>{deadlines.simplifiedStatement}</b>까지</li>
            <li>지방소득세(특별징수분): 위택스에서 <b>{deadlines.withholdingReturn}</b>까지</li>
          </ul>
        </div>
        <div className="text-gray-600">
          <div className="font-semibold text-gray-800">계산 기준</div>
          소득세 {Math.round(settings.income_tax_rate * 1000) / 10}% + 지방소득세(소득세의 {Math.round(settings.local_tax_rate * 100)}%), 10원 미만 절사, 소득세 1,000원 미만 소액부징수.
          업종코드 {settings.business_code}. 기사를 프리랜서(인적용역 사업소득)로 보는 경우 기준이며, 근로계약 관계면 다르게 신고해야 합니다. 첫 신고 전 세무사 확인을 권장합니다.
        </div>
      </div>

      {missing.length > 0 && (
        <div className="card border-red-200 text-sm text-red-700">
          신고 정보가 부족한 대상: {missing.map((d) => d.name).join(", ")} — 기사 미지정 차량의 운행분이거나 주민번호/계좌가 없습니다.
        </div>
      )}

      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>기사</th><th>주민번호</th><th className="text-right">콜</th><th className="text-right">지급액</th><th className="text-right">소득세</th><th className="text-right">지방소득세</th><th className="text-right">차인지급액</th></tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.driverId ?? "none"}>
                <td>
                  <details>
                    <summary className="cursor-pointer font-medium">{d.name}</summary>
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                      {d.items.map((it, i) => <li key={i}>{it.date} {it.plate} {it.bookingNo} {it.product} — {won(it.fare)}</li>)}
                    </ul>
                  </details>
                </td>
                <td className="text-xs">{d.rrnMasked ?? <span className="text-red-600">없음</span>}</td>
                <td className="text-right">{d.calls}</td>
                <td className="text-right">{won(d.gross)}</td>
                <td className="text-right">{won(d.incomeTax)}</td>
                <td className="text-right">{won(d.localTax)}</td>
                <td className="text-right font-semibold">{won(d.net)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="text-gray-500">{month}에 확정된 배차가 없습니다.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-2">합계</td><td />
                <td className="px-3 py-2 text-right">{total.calls}</td>
                <td className="px-3 py-2 text-right">{won(total.gross)}</td>
                <td className="px-3 py-2 text-right">{won(total.incomeTax)}</td>
                <td className="px-3 py-2 text-right">{won(total.localTax)}</td>
                <td className="px-3 py-2 text-right">{won(total.net)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
