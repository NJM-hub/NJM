import Link from "next/link";
import MonthlyChart from "@/components/MonthlyChart";
import PageHeader from "@/components/PageHeader";
import { todayKst } from "@/lib/dates";
import { won } from "@/lib/format";
import { listAllInvestments, listPaymentsBetween, listSchedulesBetween } from "@/lib/queries";
import { liveInvestments, monthly } from "@/lib/stats";

import { requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePage();
  const { year: y } = await searchParams;
  const today = todayKst();
  const thisYear = Number(today.slice(0, 4));
  const year = /^\d{4}$/.test(y ?? "") ? Number(y) : thisYear;
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [investments, schedules, payments] = await Promise.all([
    listAllInvestments(),
    listSchedulesBetween(from, to),
    listPaymentsBetween(from, to),
  ]);
  const rows = monthly(investments, schedules, payments, year);
  const total = rows.reduce(
    (a, r) => ({
      executedAmount: a.executedAmount + r.executedAmount,
      executedCount: a.executedCount + r.executedCount,
      newCount: a.newCount + r.newCount,
      collectedAmount: a.collectedAmount + r.collectedAmount,
      collectedCount: a.collectedCount + r.collectedCount,
      unpaidAmount: a.unpaidAmount + r.unpaidAmount,
    }),
    { executedAmount: 0, executedCount: 0, newCount: 0, collectedAmount: 0, collectedCount: 0, unpaidAmount: 0 },
  );

  // 데이터가 있는 해 + 올해
  const years = new Set<number>([thisYear, year]);
  for (const r of liveInvestments(investments)) years.add(Number(r.executed_on.slice(0, 4)));
  const yearList = [...years].sort((a, b) => b - a);
  const thisMonth = today.slice(0, 7);

  return (
    <>
      <PageHeader
        title="월별 통계"
        description="취소 건 제외 · 표의 숫자와 그래프는 같은 데이터입니다"
        actions={
          <div className="flex flex-wrap gap-1">
            {yearList.map((v) => (
              <Link key={v} href={`/stats?year=${v}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${v === year ? "bg-navy-800 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {v}년
              </Link>
            ))}
          </div>
        }
      />

      <section className="card card-body">
        <h2 className="mb-3 text-base font-semibold text-navy-900">{year}년 월별 투자 실행금액 · 회수금액</h2>
        <MonthlyChart rows={rows} />
      </section>

      <section className="card mt-5 overflow-x-auto">
        <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
          <thead>
            <tr>
              <th>월</th>
              <th className="num">투자 실행금액</th>
              <th className="num">실행 건수</th>
              <th className="num">신규 투자 건수</th>
              <th className="num">회수금액</th>
              <th className="num">회수 건수</th>
              <th className="num">미회수금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className={r.month === thisMonth ? "bg-navy-50" : ""}>
                <td className="font-medium">{Number(r.month.slice(5))}월{r.month === thisMonth && <span className="ml-1 text-xs text-navy-600">(이번 달)</span>}</td>
                <td className="num">{won(r.executedAmount)}</td>
                <td className="num">{r.executedCount}</td>
                <td className="num">{r.newCount}</td>
                <td className="num">{won(r.collectedAmount)}</td>
                <td className="num">{r.collectedCount}</td>
                <td className={`num ${r.unpaidAmount > 0 && r.month < thisMonth ? "font-semibold text-red-700" : ""}`}>{won(r.unpaidAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold [&_td]:border-t [&_td]:border-slate-200">
              <td>합계</td>
              <td className="num">{won(total.executedAmount)}</td>
              <td className="num">{total.executedCount}</td>
              <td className="num">{total.newCount}</td>
              <td className="num">{won(total.collectedAmount)}</td>
              <td className="num">{total.collectedCount}</td>
              <td className="num">{won(total.unpaidAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        <li>· <b>투자 실행금액·실행 건수</b>: 그 달에 실행한 투자 (투자 실행일 기준)</li>
        <li>· <b>신규 투자 건수</b>: 그중 처음 투자한 고객의 투자</li>
        <li>· <b>회수금액·회수 건수</b>: 그 달에 실제로 입금된 금액과 입금 기록 수 (취소된 입금 제외)</li>
        <li>· <b>미회수금액</b>: 그 달에 받기로 예정된 회차 중 아직 받지 못한 금액 (지난 달은 빨간색 = 연체)</li>
      </ul>
    </>
  );
}
