import Link from "next/link";
import AlertBadge from "@/components/AlertBadge";
import ListControls from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { diffDays, todayKst } from "@/lib/dates";
import { pct, won, ymd } from "@/lib/format";
import { applyListQuery, LIST_FILTERS, LIST_SORTS, parseListQuery } from "@/lib/listing";
import { listAllInvestments } from "@/lib/queries";
import { alertLevel, dDayLabel } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const query = parseListQuery(sp);
  const today = todayKst();
  const { rows, counts } = applyListQuery(await listAllInvestments(), query, today);

  const filterHref = (filter: string) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (filter !== "all") p.set("filter", filter);
    if (query.sort !== "executed") p.set("sort", query.sort);
    if (query.dir !== "desc") p.set("dir", query.dir);
    const s = p.toString();
    return s ? `/investments?${s}` : "/investments";
  };
  const sumRemaining = rows.reduce((a, r) => a + r.remaining_amount, 0);
  const sumPrincipal = rows.reduce((a, r) => a + r.principal, 0);

  return (
    <>
      <PageHeader
        title="투자 목록"
        description={`${rows.length.toLocaleString("ko-KR")}건 · 투자금액 ${won(sumPrincipal)} · 미회수 ${won(sumRemaining)}`}
        actions={<Link href="/investments/new" className="btn">+ 투자 등록</Link>}
      />

      <div className="card card-body mb-4 space-y-3">
        <ListControls placeholder="투자번호·대상명·고객명·연락처 검색" sorts={LIST_SORTS} />
        <div className="flex flex-wrap gap-2">
          {LIST_FILTERS.map((f) => (
            <Link key={f.value} href={filterHref(f.value)} scroll={false}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                query.filter === f.value ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              {f.label} {counts[f.value]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card card-body py-16 text-center">
          <p className="text-slate-500">{query.q || query.filter !== "all" ? "조건에 맞는 투자가 없습니다." : "등록된 투자가 없습니다."}</p>
          {!query.q && query.filter === "all" && <Link href="/investments/new" className="btn mt-4">첫 투자 등록하기</Link>}
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
                  <th className="num">미회수</th>
                  <th className="num">회수율</th>
                  <th>만기일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lv = alertLevel(r, today);
                  return (
                    <tr key={r.id} className={`relative hover:bg-navy-50 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                      <td className="font-mono text-xs">
                        <Link href={`/investments/${r.id}`} className="after:absolute after:inset-0">{r.investment_no}</Link>
                      </td>
                      <td className="max-w-48 truncate font-medium text-navy-900">{r.target_name}</td>
                      <td>{r.customer_name}</td>
                      <td>{ymd(r.executed_on)}</td>
                      <td className="num">{won(r.principal)}</td>
                      <td className="num font-semibold">{won(r.remaining_amount)}</td>
                      <td className="num">{pct(r.recovery_rate)}</td>
                      <td>
                        {ymd(r.maturity_on)}
                        {lv && lv !== "overdue" && <span className="ml-1 text-xs font-semibold text-orange-700">{dDayLabel(diffDays(today, r.maturity_on))}</span>}
                      </td>
                      <td>
                        <span className="inline-flex gap-1">
                          <StatusBadge status={r.status} />
                          {lv && <AlertBadge level={lv} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 휴대폰: 카드 */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => {
              const lv = alertLevel(r, today);
              return (
                <Link key={r.id} href={`/investments/${r.id}`}
                  className={`card card-body block active:bg-navy-50 ${r.status === "cancelled" ? "opacity-50" : ""} ${lv === "overdue" ? "border-l-4 border-l-red-700" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-navy-900">{r.target_name}</div>
                      <div className="text-xs text-slate-500">{r.investment_no} · {r.customer_name}</div>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      {lv && <AlertBadge level={lv} />}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                    <span className="text-slate-500">투자금액</span><span className="text-right tabular-nums">{won(r.principal)}</span>
                    <span className="text-slate-500">미회수</span><span className="text-right font-semibold tabular-nums">{won(r.remaining_amount)}</span>
                    <span className="text-slate-500">회수율</span><span className="text-right tabular-nums">{pct(r.recovery_rate)}</span>
                    <span className="text-slate-500">만기일</span><span className="text-right">{ymd(r.maturity_on)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
