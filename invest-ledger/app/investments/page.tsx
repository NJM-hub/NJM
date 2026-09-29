import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { pct, won, ymd } from "@/lib/format";
import { listInvestments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const includeCancelled = all === "1";
  const rows = await listInvestments({ includeCancelled });

  return (
    <>
      <PageHeader
        title="투자 목록"
        description={`총 ${rows.length.toLocaleString("ko-KR")}건 · 행을 누르면 상세 화면으로 이동합니다.`}
        actions={
          <>
            <Link href={includeCancelled ? "/investments" : "/investments?all=1"} className="btn-secondary">
              {includeCancelled ? "취소 건 숨기기" : "취소 건 포함"}
            </Link>
            <Link href="/investments/new" className="btn">+ 투자 등록</Link>
          </>
        }
      />

      {rows.length === 0 ? (
        <div className="card card-body py-16 text-center">
          <p className="text-slate-500">등록된 투자가 없습니다.</p>
          <Link href="/investments/new" className="btn mt-4">첫 투자 등록하기</Link>
        </div>
      ) : (
        <>
          {/* PC: 표 */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
              <thead>
                <tr>
                  <th>투자번호</th>
                  <th>투자 대상</th>
                  <th>고객</th>
                  <th>실행일</th>
                  <th className="num">투자금액</th>
                  <th className="num">회수 예정</th>
                  <th className="num">미회수</th>
                  <th className="num">회수율</th>
                  <th>만기일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`relative hover:bg-navy-50 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                    <td className="font-mono text-xs">
                      <Link href={`/investments/${r.id}`} className="after:absolute after:inset-0">{r.investment_no}</Link>
                    </td>
                    <td className="font-medium text-navy-900">{r.target_name}</td>
                    <td>{r.customer_name}</td>
                    <td>{ymd(r.executed_on)}</td>
                    <td className="num">{won(r.principal)}</td>
                    <td className="num">{won(r.expected_total)}</td>
                    <td className="num font-semibold">{won(r.remaining_amount)}</td>
                    <td className="num">{pct(r.recovery_rate)}</td>
                    <td>{ymd(r.maturity_on)}</td>
                    <td><StatusBadge status={r.status} overdue={r.overdue_count > 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 휴대폰: 카드 */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <Link key={r.id} href={`/investments/${r.id}`}
                className={`card card-body block active:bg-navy-50 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900">{r.target_name}</div>
                    <div className="text-xs text-slate-500">{r.investment_no} · {r.customer_name}</div>
                  </div>
                  <StatusBadge status={r.status} overdue={r.overdue_count > 0} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-slate-500">투자금액</span><span className="text-right tabular-nums">{won(r.principal)}</span>
                  <span className="text-slate-500">회수 예정</span><span className="text-right tabular-nums">{won(r.expected_total)}</span>
                  <span className="text-slate-500">미회수</span><span className="text-right font-semibold tabular-nums">{won(r.remaining_amount)}</span>
                  <span className="text-slate-500">만기일</span><span className="text-right">{ymd(r.maturity_on)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
