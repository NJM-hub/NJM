import Link from "next/link";
import EnvNotice from "@/components/EnvNotice";
import StatusBadge from "@/components/StatusBadge";
import { REPAYMENT_METHODS } from "@/lib/constants";
import { percent, rate, won, ymd } from "@/lib/format";
import { missingEnv } from "@/lib/env";
import { listInvestments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <EnvNotice missing={missing} />;

  const { all } = await searchParams;
  const showAll = all === "1";
  const rows = await listInvestments({ includeCancelled: showAll });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">투자 목록</h1>
        <div className="flex gap-2">
          <Link href={showAll ? "/investments" : "/investments?all=1"} className="btn-secondary">
            {showAll ? "취소 건 숨기기" : "취소 건 포함"}
          </Link>
          <Link href="/investments/new" className="btn">
            + 투자 등록
          </Link>
        </div>
      </div>

      <p className="text-sm text-slate-500">총 {rows.length.toLocaleString("ko-KR")}건 · 검색/필터/정렬은 4단계에서 추가됩니다.</p>

      {rows.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">
          아직 등록된 투자가 없습니다.{" "}
          <Link href="/investments/new" className="text-navy-600 underline">
            첫 투자를 등록
          </Link>
          해 보세요.
        </div>
      ) : (
        <>
          {/* PC: 표 */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>투자번호</th>
                  <th>실행일</th>
                  <th>투자 대상</th>
                  <th>고객</th>
                  <th className="num">투자금액</th>
                  <th className="num">수익률</th>
                  <th>회수방식</th>
                  <th className="num">회수금액</th>
                  <th className="num">미회수금액</th>
                  <th className="num">회수율</th>
                  <th>만기일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-navy-50/50">
                    <td>
                      <Link href={`/investments/${r.id}`} className="font-medium text-navy-700 hover:underline">
                        {r.investment_no}
                      </Link>
                    </td>
                    <td>{ymd(r.executed_on)}</td>
                    <td>
                      <Link href={`/investments/${r.id}`} className="hover:underline">
                        {r.target_name}
                      </Link>
                    </td>
                    <td>{r.customer_name}</td>
                    <td className="num">{won(r.principal)}</td>
                    <td className="num">{rate(r.return_rate)}</td>
                    <td>{REPAYMENT_METHODS[r.repayment_method]}</td>
                    <td className="num">{won(r.paid_total)}</td>
                    <td className="num">{won(r.remaining_amount)}</td>
                    <td className="num">{percent(r.recovery_rate)}</td>
                    <td>{ymd(r.maturity_on)}</td>
                    <td>
                      <StatusBadge status={r.status} overdue={r.overdue_amount > 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 휴대폰: 카드 */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <Link key={r.id} href={`/investments/${r.id}`} className="card block p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy-900">{r.target_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.investment_no} · {r.customer_name}
                    </p>
                  </div>
                  <StatusBadge status={r.status} overdue={r.overdue_amount > 0} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-slate-500">투자금액</dt>
                  <dd className="text-right">{won(r.principal)}</dd>
                  <dt className="text-slate-500">미회수금액</dt>
                  <dd className="text-right font-medium">{won(r.remaining_amount)}</dd>
                  <dt className="text-slate-500">회수율</dt>
                  <dd className="text-right">{percent(r.recovery_rate)}</dd>
                  <dt className="text-slate-500">만기일</dt>
                  <dd className="text-right">{ymd(r.maturity_on)}</dd>
                </dl>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
