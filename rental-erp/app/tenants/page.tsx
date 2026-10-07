import Link from "next/link";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { effectiveStatus } from "@/lib/engine";
import { phoneDigits, won } from "@/lib/format";
import { compareUnits, unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const { ds, snap: s } = await getSnapshot();
  const scopeUnits = new Set(s.units.map((u) => u.unit.id));
  const needle = (sp.q ?? "").trim().toLowerCase();
  const digits = phoneDigits(needle);
  const unitById = new Map(ds.units.map((u) => [u.id, u]));
  const rows = ds.tenants
    .map((t) => {
      const cs = ds.contracts.filter((c) => c.tenant_id === t.id).sort((a, b) => b.start_date.localeCompare(a.start_date));
      const current = cs.find((c) => ["active", "expiring", "planned"].includes(effectiveStatus(c, s.today)));
      const unpaid = s.arrears.filter((a) => a.contract.tenant_id === t.id).reduce((x, a) => x + a.total, 0);
      const unit = unitById.get((current ?? cs[0])?.unit_id ?? "");
      return { t, cs, current, unpaid, unit };
    })
    .filter((r) => r.cs.length === 0 || r.cs.some((c) => scopeUnits.has(c.unit_id)))
    .filter((r) => sp.all || r.current || r.unpaid > 0 || r.cs.length === 0)
    .filter(
      (r) =>
        !needle ||
        r.t.name.toLowerCase().includes(needle) ||
        (digits.length >= 3 && phoneDigits(r.t.phone).includes(digits)) ||
        (r.t.biz_no ?? "").includes(needle),
    )
    // 빌딩 순서 (현재 계약 호실, 없으면 마지막 계약 호실) → 계약 없는 임차인은 맨 뒤
    .sort((a, b) => compareUnits(ds, a.unit, b.unit) || Number(!a.current) - Number(!b.current) || a.t.name.localeCompare(b.t.name, "ko"));

  return (
    <div>
      <PageHeader title="👤 임차인" desc="현재 계약 중이거나 미납이 있는 임차인 (지난 임차인 포함은 '전체')" actions={can.editLeasing && <Link href="/tenants/new" className="btn">+ 임차인 등록</Link>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} className="input max-w-xs" placeholder="이름 · 전화번호 · 사업자번호" />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} className="accent-navy-800" /> 지난 임차인 포함
        </label>
        <button className="btn-secondary">검색</button>
      </form>
      <div className="card card-body">
        {rows.length === 0 ? (
          <Empty>임차인이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>임차인</th>
                <th>연락처</th>
                <th>현재 계약</th>
                <th>계약기간</th>
                <th className="num">월세</th>
                <th className="num">미납</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, current, unpaid, cs }) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tenants/${t.id}`} className="link">
                      {t.name}
                    </Link>
                    {t.biz_no && <div className="text-xs text-slate-500">{t.biz_no}</div>}
                  </td>
                  <td>{t.phone ? <a href={`tel:${t.phone}`}>{t.phone}</a> : "-"}</td>
                  <td>{current ? unitLabel(ds, current.unit_id) : <Badge>{cs.length ? "종료" : "계약 없음"}</Badge>}</td>
                  <td className="text-xs">{current ? `${fmtDate(current.start_date)} ~ ${fmtDate(current.end_date)}` : "-"}</td>
                  <td className="num">{current ? won(current.monthly_rent) : "-"}</td>
                  <td className={`num ${unpaid ? "font-bold text-red-600" : "text-slate-400"}`}>{unpaid ? won(unpaid) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
