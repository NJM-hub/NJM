import Link from "next/link";
import { ArrearsList, where } from "@/components/lists";
import { StatusBadge } from "@/components/panels";
import { Card, Empty, PageHeader, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/dates";
import { effectiveStatus } from "@/lib/engine";
import { phoneDigits, won, wonShort } from "@/lib/format";
import { unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

/** 통합 검색: 임차인 이름 · 전화번호 · 주소 · 건물명 · 호실 · 계약번호 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePage();
  const { q: raw = "" } = await searchParams;
  const needle = raw.trim().toLowerCase();
  const { ds, snap: s } = await getSnapshot(true);
  if (!needle) {
    return (
      <div>
        <PageHeader title="🔍 검색" />
        <Empty>위 검색창에 임차인 이름, 전화번호, 주소, 건물명, 호실, 계약번호를 입력하세요.</Empty>
      </div>
    );
  }
  const digits = phoneDigits(needle);
  const has = (v: string | null | undefined) => !!v && v.toLowerCase().includes(needle);
  const tenants = ds.tenants.filter((t) => has(t.name) || (digits.length >= 3 && phoneDigits(t.phone).includes(digits)) || has(t.biz_no));
  const props = ds.properties.filter((p) => has(p.name) || has(p.address) || has(p.building_name));
  const units = ds.units.filter((u) => has(u.unit_no) || has(`${u.dong ?? ""}${u.unit_no}`));
  const tIds = new Set(tenants.map((t) => t.id));
  const uIds = new Set(units.map((u) => u.id));
  const pIds = new Set(props.map((p) => p.id));
  const contracts = ds.contracts
    .filter((c) => has(c.contract_no) || tIds.has(c.tenant_id) || uIds.has(c.unit_id) || pIds.has(ds.units.find((u) => u.id === c.unit_id)?.property_id ?? ""))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const cIds = new Set(contracts.map((c) => c.id));
  const arrears = s.arrears.filter((a) => cIds.has(a.contract.id));
  const payments = ds.payments.filter((p) => cIds.has(p.contract_id)).sort((a, b) => b.paid_date.localeCompare(a.paid_date)).slice(0, 30);
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <PageHeader title={`🔍 "${raw}" 검색 결과`} desc={`임차인 ${tenants.length} · 부동산 ${props.length} · 계약 ${contracts.length}`} />
      {tenants.length > 0 && (
        <Card title="👤 임차인">
          <ul className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <Link href={`/tenants/${t.id}`} className="link">
                  {t.name}
                </Link>
                <span className="text-slate-500">{t.phone}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {props.length > 0 && (
        <Card title="🏢 부동산">
          <ul className="divide-y divide-slate-100">
            {props.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <Link href={`/properties/${p.id}`} className="link">
                  {p.name}
                </Link>
                <span className="text-slate-500">{p.address}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {arrears.length > 0 && (
        <Card title="🔴 미납금">
          <ArrearsList items={arrears} />
        </Card>
      )}
      <Card title="📄 계약 · 계약기간">
        {contracts.length === 0 ? (
          <Empty>계약이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>계약번호</th>
                <th>임차인</th>
                <th>부동산 / 호실</th>
                <th>상태</th>
                <th>계약기간</th>
                <th className="num">남은 일수</th>
                <th className="num">보증금</th>
                <th className="num">월세</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="link">
                      {c.contract_no}
                    </Link>
                  </td>
                  <td>{tenant.get(c.tenant_id)?.name}</td>
                  <td>{unitLabel(ds, c.unit_id)}</td>
                  <td>
                    <StatusBadge s={effectiveStatus(c, s.today)} />
                  </td>
                  <td className="text-xs">{fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}</td>
                  <td className="num text-xs">{daysBetween(s.today, c.end_date) >= 0 ? `${daysBetween(s.today, c.end_date)}일` : "-"}</td>
                  <td className="num">{wonShort(c.deposit)}</td>
                  <td className="num">{won(c.monthly_rent)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {payments.length > 0 && (
        <Card title="💰 최근 입금내역">
          <Table>
            <thead>
              <tr>
                <th>입금일</th>
                <th>임차인 / 호실</th>
                <th className="num">금액</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const c = contractById.get(p.contract_id)!;
                const u = ds.units.find((x) => x.id === c.unit_id);
                return (
                  <tr key={p.id}>
                    <td>{fmtDate(p.paid_date)}</td>
                    <td>
                      {tenant.get(c.tenant_id)?.name} / {where(ds.properties.find((x) => x.id === u?.property_id), u)}
                    </td>
                    <td className="num">{won(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
