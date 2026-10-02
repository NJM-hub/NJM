import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { PROPERTY_TYPES, label } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import type { PropertyMetrics } from "@/lib/engine";
import { pct, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = {
  all: "전체",
  leased: "임대중",
  vacant: "공실",
  arrears: "미납",
  expiring: "계약만료 예정",
  loan: "대출 있음",
  noloan: "대출 없음",
} as const;

const SORTS = {
  name: "이름순",
  deposit: "보증금 많은 순",
  rent: "월세 많은 순",
  yield: "수익률 높은 순",
  net: "순수익 많은 순",
} as const;

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ filter?: string; sort?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const filter = (sp.filter && sp.filter in FILTERS ? sp.filter : "all") as keyof typeof FILTERS;
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "name") as keyof typeof SORTS;
  const { snap: s } = await getSnapshot();

  const expiringProps = new Set(s.expiring.map((e) => e.property?.id));
  const test: Record<keyof typeof FILTERS, (p: PropertyMetrics) => boolean> = {
    all: () => true,
    leased: (p) => p.occupiedCount > 0,
    vacant: (p) => p.vacantCount > 0,
    arrears: (p) => p.unpaid > 0,
    expiring: (p) => expiringProps.has(p.property.id),
    loan: (p) => p.loanCount > 0,
    noloan: (p) => p.loanCount === 0,
  };
  const list = s.properties.filter(test[filter]).sort((a, b) => {
    if (sort === "deposit") return b.deposits - a.deposits;
    if (sort === "rent") return b.monthlyRent - a.monthlyRent;
    if (sort === "yield") return (b.leveragedYield ?? -999) - (a.leveragedYield ?? -999);
    if (sort === "net") return b.monthlyNet - a.monthlyNet;
    return a.property.name.localeCompare(b.property.name, "ko");
  });

  const href = (o: { filter?: string; sort?: string }) => {
    const p = new URLSearchParams({ filter: o.filter ?? filter, sort: o.sort ?? sort });
    return `/properties?${p}`;
  };

  return (
    <div>
      <PageHeader
        title="🏢 부동산"
        desc={`${s.properties.length}개 부동산 · ${s.totals.unitCount}개 호실 (임대 중 ${s.totals.occupiedUnits} · 공실 ${s.totals.vacantUnits})`}
        actions={can.editAssets && <Link href="/properties/new" className="btn">+ 부동산 등록</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FILTERS).map(([k, v]) => {
            const n = s.properties.filter(test[k as keyof typeof FILTERS]).length;
            return (
              <Link
                key={k}
                href={href({ filter: k })}
                className={`rounded-full px-3 py-1 text-sm font-medium ${filter === k ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                {v} <span className="opacity-60">{n}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {Object.entries(SORTS).map(([k, v]) => (
            <Link key={k} href={href({ sort: k })} className={`rounded-md px-2 py-1 ${sort === k ? "bg-navy-50 font-semibold text-navy-800" : "text-slate-500 hover:bg-slate-100"}`}>
              {v}
            </Link>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>조건에 맞는 부동산이 없습니다.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Link key={p.property.id} href={`/properties/${p.property.id}`} className="card card-body block transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold text-navy-950">{p.property.name}</div>
                  <div className="truncate text-xs text-slate-500">{p.property.address ?? "-"}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="blue">{label(PROPERTY_TYPES, p.property.property_type)}</Badge>
                  {p.owner && <span className="text-[11px] text-slate-500">{p.owner.name}</span>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={p.vacantCount === 0 ? "green" : p.occupiedCount === 0 ? "red" : "orange"}>
                  호실 {p.unitCount} · 임대 {p.occupiedCount} · 공실 {p.vacantCount}
                </Badge>
                {p.unpaid > 0 && <Badge tone="red">미납 {wonShort(p.unpaid)}</Badge>}
                {expiringProps.has(p.property.id) && <Badge tone="orange">만료 예정</Badge>}
                {p.loanCount > 0 ? <Badge tone="gray">대출 {wonShort(p.loanBalance)}</Badge> : <Badge tone="gray">대출 없음</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <div>
                  <dt className="text-[11px] text-slate-500">월세</dt>
                  <dd className="text-sm font-bold tabular-nums">{wonShort(p.monthlyRent)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">월 순수익</dt>
                  <dd className={`text-sm font-bold tabular-nums ${p.monthlyNet < 0 ? "text-red-600" : "text-emerald-700"}`}>{wonShort(p.monthlyNet)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">자기자본 수익률</dt>
                  <dd className={`text-sm font-bold tabular-nums ${(p.leveragedYield ?? 0) < 0 ? "text-red-600" : ""}`}>{pct(p.leveragedYield)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">보증금</dt>
                  <dd className="text-sm font-semibold tabular-nums">{wonShort(p.deposits)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">월 이자</dt>
                  <dd className="text-sm font-semibold tabular-nums">{wonShort(p.monthlyInterest)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">임대수익률</dt>
                  <dd className="text-sm font-semibold tabular-nums">{pct(p.simpleYield)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
