import { requireOwner } from "@/lib/auth";
import { isMonth, todayKst, won } from "@/lib/format";
import { loadSettings } from "@/lib/settings";
import { ledgerMonths, loadMonthLedger, type MonthLedger } from "@/lib/settlement/monthlyLedger";
import { filingDeadlines } from "@/lib/tax";
import { saveMonthLedger } from "./actions";

function prevMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const monthLabel = (m: string) => `${m.slice(2, 4)}년 ${Number(m.slice(5))}월`;
const signed = (n: number) => <span className={n < 0 ? "text-red-600" : ""}>{won(n)}</span>;

function MoneyInput({ form, name, value }: { form: string; name: string; value: number }) {
  return <input form={form} name={name} defaultValue={value ? value.toLocaleString("ko-KR") : ""} placeholder="0" inputMode="numeric" className="input w-28 text-right" />;
}

export default async function SettlementPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : prevMonth(todayKst());
  const { supabase } = await requireOwner();
  const settings = await loadSettings(supabase);
  const months = await ledgerMonths(supabase);
  const rows: MonthLedger[] = await Promise.all(months.map((m) => loadMonthLedger(supabase, m)));
  const sum = (f: (r: MonthLedger) => number) => rows.reduce((s, r) => s + f(r), 0);
  const deadlines = filingDeadlines(month);
  const q = `month=${month}`;

  return (
    <div className="space-y-6">
      <h1 className="page-title">정산 · 세무신고</h1>

      <div className="card overflow-x-auto !p-0">
        <div className="px-4 pt-4">
          <div className="font-semibold">샌딩 · 픽업 전체 정산표</div>
          <p className="mt-1 text-xs text-gray-500">
            KKday 정산 합계는 정산내역서(실제 정산 받은 금액, 부가세 포함), 비용은 차량별 월정산의 비용 + 외부로 준 콜 금액, 기사 지급은 차량별 월정산의 차액(세액 포함)입니다.
            차량 할부금·원천 지출(현금)·사무실 지출은 직접 입력 후 저장하세요. 남은 차액 = 부가세 제외 − 비용 − 기사 지급 − 할부금 − 원천 지출 − 사무실 지출.
          </p>
        </div>
        <table className="table mt-3">
          <thead>
            <tr>
              <th>월</th>
              <th className="text-right">KKday 정산 합계</th>
              <th className="text-right">KKday 부가세 제외</th>
              <th className="text-right">비용</th>
              <th className="text-right">기사 지급(세액포함)</th>
              <th className="text-right">차량 할부금</th>
              <th className="text-right">원천 지출(현금)</th>
              <th className="text-right">사무실 지출</th>
              <th className="text-right">남은 차액</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = `ledger-${r.month}`;
              return (
                <tr key={r.month}>
                  <td className="whitespace-nowrap font-medium">{monthLabel(r.month)}</td>
                  <td className="text-right">{won(r.kkdayAmount)}</td>
                  <td className="text-right">{won(r.kkdayNet)}</td>
                  <td className="text-right">
                    {won(r.cost)}
                    <div className="whitespace-nowrap text-xs text-gray-500">차량 {won(r.vehicleExpenses)} · 외부 콜 {won(r.externalFare)}</div>
                  </td>
                  <td className="text-right">{won(r.driverPay)}</td>
                  <td className="text-right"><MoneyInput form={f} name="vehicle_installment" value={r.installment} /></td>
                  <td className="text-right"><MoneyInput form={f} name="cash_expense" value={r.cashExpense} /></td>
                  <td className="text-right"><MoneyInput form={f} name="office_expense" value={r.officeExpense} /></td>
                  <td className="whitespace-nowrap text-right font-semibold">{signed(r.remain)}</td>
                  <td>
                    <form id={f} action={saveMonthLedger}>
                      <input type="hidden" name="month" value={r.month} />
                      <input type="hidden" name="memo" value={r.memo ?? ""} />
                      <button className="btn-secondary whitespace-nowrap">저장</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={10} className="text-gray-500">정산할 달이 없습니다.</td></tr>}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.kkdayAmount))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.kkdayNet))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.cost))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.driverPay))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.installment))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.cashExpense))}</td>
                <td className="px-3 py-2 text-right">{won(sum((r) => r.officeExpense))}</td>
                <td className="px-3 py-2 text-right">{signed(sum((r) => r.remain))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="month">원천세 신고 자료 (귀속 월)</label>
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
    </div>
  );
}
