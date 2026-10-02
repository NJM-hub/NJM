import Link from "next/link";
import { StatusBadge } from "@/components/panels";
import { Empty, PageHeader, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { EFFECTIVE_STATUS, type EffectiveStatus } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/dates";
import { effectiveStatus, expiryLevel } from "@/lib/engine";
import { num, won, wonShort } from "@/lib/format";
import { unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, string> = { current: "진행 중", all: "전체", ...EFFECTIVE_STATUS };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const filter = sp.filter && sp.filter in FILTERS ? sp.filter : "current";
  const { ds, snap: s } = await getSnapshot();
  const scopeUnits = new Set(s.units.map((u) => u.unit.id));
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const unpaid = new Map(s.arrears.map((a) => [a.contract.id, a.total]));
  const rows = ds.contracts
    .filter((c) => scopeUnits.has(c.unit_id))
    .map((c) => ({ c, st: effectiveStatus(c, s.today) }));
  const count = (f: string) => rows.filter((r) => match(f, r.st)).length;
  const list = rows
    .filter((r) => match(filter, r.st))
    .sort((a, b) => (filter === "expiring" ? a.c.end_date.localeCompare(b.c.end_date) : b.c.start_date.localeCompare(a.c.start_date)));

  return (
    <div>
      <PageHeader
        title="📄 계약관리"
        desc="계약 종료일이 가까워지면 🔴 30일 · 🟠 60일 · 🟡 90일 이내로 표시합니다."
        actions={can.editLeasing && <Link href="/contracts/new" className="btn">+ 계약 등록 (계약서 AI 인식)</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link
            key={k}
            href={`/contracts?filter=${k}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${filter === k ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {v} <span className="opacity-60">{count(k)}</span>
          </Link>
        ))}
      </div>
      <div className="card card-body">
        {list.length === 0 ? (
          <Empty>해당하는 계약이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>계약번호</th>
                <th>부동산 / 호실</th>
                <th>임차인</th>
                <th>상태</th>
                <th>계약기간</th>
                <th className="num">남은 기간</th>
                <th className="num">보증금</th>
                <th className="num">월세</th>
                <th className="num">미납</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ c, st }) => {
                const left = daysBetween(s.today, c.end_date);
                const lvl = st === "expiring" ? expiryLevel(left) : null;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="link">
                        {c.contract_no}
                      </Link>
                    </td>
                    <td>{unitLabel(ds, c.unit_id)}</td>
                    <td>
                      <Link href={`/tenants/${c.tenant_id}`} className="hover:underline">
                        {tenant.get(c.tenant_id)?.name}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge s={st} />
                    </td>
                    <td className="text-xs">
                      {fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}
                    </td>
                    <td className={`num text-xs font-semibold ${lvl === "red" ? "text-red-600" : lvl === "orange" ? "text-orange-600" : lvl === "yellow" ? "text-amber-600" : "text-slate-500"}`}>
                      {lvl ? { red: "🔴 ", orange: "🟠 ", yellow: "🟡 " }[lvl] : ""}
                      {left >= 0 && ["active", "expiring", "planned"].includes(st) ? `D-${left}` : "-"}
                    </td>
                    <td className="num">{wonShort(c.deposit)}</td>
                    <td className="num">{won(c.monthly_rent)}</td>
                    <td className={`num ${unpaid.get(c.id) ? "font-bold text-red-600" : "text-slate-400"}`}>{unpaid.get(c.id) ? num(unpaid.get(c.id)) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}

function match(f: string, st: EffectiveStatus) {
  if (f === "all") return true;
  if (f === "current") return st === "active" || st === "expiring" || st === "planned";
  return st === f;
}
