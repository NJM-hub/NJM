import Link from "next/link";
import ListControls from "@/components/ListControls";
import PageHeader from "@/components/PageHeader";
import { todayKst } from "@/lib/dates";
import { won, ymd } from "@/lib/format";
import { customerSummaries, matchesCustomer } from "@/lib/listing";
import { listAllCustomers, listAllInvestments } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SORTS = [
  { value: "remaining", label: "미회수금액" },
  { value: "principal", label: "총 투자금액" },
  { value: "count", label: "투자 건수" },
  { value: "overdue", label: "연체 건수" },
  { value: "name", label: "고객명" },
] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const showInactive = sp.inactive === "1";
  const sort = SORTS.some((s) => s.value === sp.sort) ? sp.sort! : "remaining";
  const dir = sp.dir === "asc" ? 1 : -1;
  const today = todayKst();

  const [customers, investments] = await Promise.all([listAllCustomers(), listAllInvestments()]);
  const inactiveCount = customers.filter((c) => c.status === "inactive").length;
  const rows = customerSummaries(customers, investments, today)
    .filter((c) => (showInactive ? true : c.status === "active") && matchesCustomer(c, q))
    .sort((a, b) => {
      const k = (c: typeof a): number | string =>
        sort === "principal" ? c.totalPrincipal : sort === "count" ? c.investmentCount : sort === "overdue" ? c.overdueCount : sort === "name" ? c.name : c.totalRemaining;
      const ka = k(a);
      const kb = k(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir || a.name.localeCompare(b.name, "ko");
    });

  const inactiveHref = () => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "inactive") p.set(k, v);
    if (!showInactive) p.set("inactive", "1");
    const s = p.toString();
    return s ? `/customers?${s}` : "/customers";
  };

  return (
    <>
      <PageHeader
        title="고객 관리"
        description={`${rows.length}명 · 고객을 누르면 모든 투자내역을 볼 수 있습니다`}
        actions={inactiveCount > 0 ? (
          <Link href={inactiveHref()} className="btn-secondary">{showInactive ? "미사용 고객 숨기기" : `미사용 고객 포함 (${inactiveCount})`}</Link>
        ) : undefined}
      />

      <div className="card card-body mb-4">
        <ListControls placeholder="고객명, 연락처로 검색" sorts={SORTS} />
      </div>

      {rows.length === 0 ? (
        <div className="card card-body py-16 text-center text-slate-500">
          {q ? "조건에 맞는 고객이 없습니다." : "등록된 고객이 없습니다. 투자를 등록하면 고객이 함께 만들어집니다."}
        </div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
              <thead>
                <tr>
                  <th>고객명</th>
                  <th>연락처</th>
                  <th className="num">투자 건수</th>
                  <th className="num">총 투자금액</th>
                  <th className="num">총 회수금액</th>
                  <th className="num">총 미회수금액</th>
                  <th className="num">연체 건수</th>
                  <th>최근 투자</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={`relative hover:bg-navy-50 ${c.status === "inactive" ? "opacity-50" : ""}`}>
                    <td className="font-medium text-navy-900">
                      <Link href={`/customers/${c.id}`} className="after:absolute after:inset-0">{c.name}</Link>
                      {c.status === "inactive" && <span className="badge ml-2 bg-gray-100 text-gray-500 ring-gray-200">미사용</span>}
                    </td>
                    <td>{c.phone || "-"}</td>
                    <td className="num">{c.investmentCount}건{c.activeCount > 0 && <span className="text-xs text-slate-500"> (진행 {c.activeCount})</span>}</td>
                    <td className="num">{won(c.totalPrincipal)}</td>
                    <td className="num">{won(c.totalCollected)}</td>
                    <td className="num font-semibold">{won(c.totalRemaining)}</td>
                    <td className={`num ${c.overdueCount > 0 ? "font-semibold text-red-700" : "text-slate-400"}`}>{c.overdueCount}건</td>
                    <td>{ymd(c.lastExecutedOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`}
                className={`card card-body block active:bg-navy-50 ${c.status === "inactive" ? "opacity-50" : ""} ${c.overdueCount > 0 ? "border-l-4 border-l-red-700" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.phone || "연락처 없음"}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {c.investmentCount}건{c.overdueCount > 0 && <div className="font-semibold text-red-700">연체 {c.overdueCount}건</div>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-slate-500">총 투자금액</span><span className="text-right tabular-nums">{won(c.totalPrincipal)}</span>
                  <span className="text-slate-500">총 회수금액</span><span className="text-right tabular-nums">{won(c.totalCollected)}</span>
                  <span className="text-slate-500">총 미회수금액</span><span className="text-right font-semibold tabular-nums">{won(c.totalRemaining)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
