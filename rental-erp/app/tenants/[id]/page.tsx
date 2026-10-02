import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrearsList } from "@/components/lists";
import { ChargesTable, PaymentsTable, StatusBadge } from "@/components/panels";
import { Card, InfoGrid, PageHeader, StatCard, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/dates";
import { effectiveStatus } from "@/lib/engine";
import { won, wonShort } from "@/lib/format";
import { unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

/** 임차인 한 명의 모든 계약·입금·미납·계약기간 */
export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { can } = await requirePage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { ds, snap: s } = await getSnapshot(true);
  const t = ds.tenants.find((x) => x.id === id);
  if (!t) notFound();
  const cs = ds.contracts.filter((c) => c.tenant_id === id).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const ids = new Set(cs.map((c) => c.id));
  const charges = ds.charges.filter((c) => ids.has(c.contract_id));
  const payments = ds.payments.filter((p) => ids.has(p.contract_id));
  const arrears = s.arrears.filter((a) => ids.has(a.contract.id));
  const unpaid = arrears.reduce((x, a) => x + a.total, 0);
  const current = cs.filter((c) => ["active", "expiring", "planned"].includes(effectiveStatus(c, s.today)));
  const where = (contractId: string) => unitLabel(ds, cs.find((c) => c.id === contractId)?.unit_id ?? "");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.name}
        desc={t.phone}
        actions={
          can.editLeasing && (
            <>
              <Link href={`/contracts/new?tenant=${id}`} className="btn-secondary">+ 계약 등록</Link>
              <Link href={`/tenants/${id}/edit`} className="btn-secondary">정보 수정</Link>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="현재 계약" value={`${current.length}건`} sub={current.map((c) => unitLabel(ds, c.unit_id)).join(", ") || "-"} />
        <StatCard label="월세 합계" value={wonShort(current.reduce((x, c) => x + c.monthly_rent, 0))} sub={`보증금 ${wonShort(current.reduce((x, c) => x + c.deposit, 0))}`} />
        <StatCard label="미납" value={won(unpaid)} tone={unpaid ? "red" : "green"} sub={arrears.length ? `최장 ${Math.max(...arrears.map((a) => a.days))}일` : "없음"} />
        <StatCard label="누적 입금" value={wonShort(payments.reduce((x, p) => x + p.amount, 0))} sub={`${payments.length}건`} />
      </div>
      <Card title="임차인 정보">
        <InfoGrid
          cols={4}
          items={[
            ["이름 / 상호", t.name],
            ["연락처", t.phone ? <a key="p" className="link" href={`tel:${t.phone}`}>{t.phone}</a> : "-"],
            ["사업자등록번호", t.biz_no],
            ["이메일", t.email],
          ]}
        />
        {t.memo && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{t.memo}</p>}
      </Card>
      {arrears.length > 0 && (
        <Card title="🔴 미납">
          <ArrearsList items={arrears} />
        </Card>
      )}
      <Card title="모든 계약">
        <Table>
          <thead>
            <tr>
              <th>계약번호</th>
              <th>부동산 / 호실</th>
              <th>상태</th>
              <th>계약기간</th>
              <th className="num">남은 일수</th>
              <th className="num">보증금</th>
              <th className="num">월세</th>
            </tr>
          </thead>
          <tbody>
            {cs.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="link" href={`/contracts/${c.id}`}>{c.contract_no}</Link>
                </td>
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
      </Card>
      <Card title="월별 청구 · 입금">
        <ChargesTable charges={charges} today={s.today} who={cs.length > 1 ? (c) => where(c.contract_id) : undefined} />
      </Card>
      <Card title="입금 내역">
        <PaymentsTable payments={payments} charges={new Map(charges.map((c) => [c.id, c]))} who={cs.length > 1 ? (p) => where(p.contract_id) : undefined} />
      </Card>
    </div>
  );
}
