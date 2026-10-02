import Link from "next/link";
import { deletePaymentAction, recordPaymentAction } from "@/app/actions/leasing";
import ActionButton from "@/components/ActionButton";
import { ChargesTable, PaymentsTable } from "@/components/panels";
import PaymentForm from "@/components/PaymentForm";
import { Card, PageHeader, StatCard, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { addMonths, fmtDate, monthLabel, monthStart } from "@/lib/dates";
import { num, pct, won, wonShort } from "@/lib/format";
import { payOptions, unitLabel } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const view = sp.view ?? "month";
  const { ds, snap: s } = await getSnapshot();
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? `${sp.month}-01` : s.month;
  const scope = new Set(s.units.map((u) => u.unit.id));
  const contracts = ds.contracts.filter((c) => scope.has(c.unit_id));
  const cIds = new Set(contracts.map((c) => c.id));
  const tenant = new Map(ds.tenants.map((t) => [t.id, t]));
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const who = (cid: string) => {
    const c = byId.get(cid);
    return c ? (
      <Link href={`/contracts/${c.id}`} className="hover:underline">
        <b>{tenant.get(c.tenant_id)?.name}</b> <span className="text-slate-500">/ {unitLabel(ds, c.unit_id)}</span>
      </Link>
    ) : null;
  };
  const charges = ds.charges.filter((c) => cIds.has(c.contract_id));
  const monthCharges = charges.filter((c) => c.billing_month === month);
  const billed = monthCharges.reduce((a, c) => a + c.amount, 0);
  const paid = monthCharges.reduce((a, c) => a + c.paid_amount, 0);
  const payments = ds.payments.filter((p) => cIds.has(p.contract_id));
  const mEnd = addMonths(month, 1);
  const monthPayments = payments.filter((p) => p.paid_date >= month && p.paid_date < mEnd);
  const chargeMap = new Map(charges.map((c) => [c.id, c]));
  const ym = month.slice(0, 7);
  const prev = addMonths(month, -1).slice(0, 7);
  const next = addMonths(month, 1).slice(0, 7);

  return (
    <div className="space-y-4">
      <PageHeader title="💰 월세 / 입금" desc="매월 납부일 기준으로 월세가 자동 청구되고, 입금하면 미납에서 자동 차감됩니다." />
      {can.editLeasing && (
        <Card title="입금 등록">
          <PaymentForm action={recordPaymentAction} contracts={payOptions(ds, s.today, (c) => cIds.has(c.id))} today={s.today} />
        </Card>
      )}

      <Tabs
        base="/payments"
        active={view}
        tabs={[
          { key: "month", label: "월별 청구 · 입금" },
          { key: "today", label: "오늘 납부 예정", count: s.today_.dueCharges.length },
          { key: "received", label: "입금 내역" },
        ]}
      />

      {view === "month" && (
        <>
          <div className="flex items-center gap-2">
            <Link href={`/payments?month=${prev}`} className="btn-secondary btn-sm">◀</Link>
            <span className="text-lg font-bold">{monthLabel(month)}</span>
            <Link href={`/payments?month=${next}`} className="btn-secondary btn-sm">▶</Link>
            {month !== monthStart(s.today) && (
              <Link href="/payments" className="btn-ghost text-sm">이번 달</Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="청구액" value={wonShort(billed)} sub={`${monthCharges.length}건`} />
            <StatCard label="입금액 (청구분)" value={wonShort(paid)} tone="green" />
            <StatCard label="미수" value={wonShort(billed - paid)} tone={billed - paid > 0 ? "red" : "green"} />
            <StatCard label="수납률" value={pct(billed ? (paid / billed) * 100 : null, 0)} sub={`이 달 실제 입금 ${wonShort(monthPayments.reduce((a, p) => a + p.amount, 0))}`} />
          </div>
          <Card title={`${ym} 청구 내역`}>
            <ChargesTable charges={monthCharges} today={s.today} who={(c) => who(c.contract_id)} />
          </Card>
        </>
      )}

      {view === "today" && (
        <Card title={`오늘(${fmtDate(s.today)}) 납부일인 월세`}>
          {s.today_.dueCharges.length === 0 ? (
            <p className="text-sm text-slate-500">오늘 납부일인 월세가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.today_.dueCharges.map((d) => (
                <li key={d.charge.id} className="flex items-center justify-between py-2.5 text-sm">
                  {who(d.contract.id)}
                  <b className="tabular-nums">{won(d.unpaid)}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {view === "received" && (
        <Card title={`입금 내역 (${monthLabel(month)})`} actions={<span className="text-xs text-slate-500">합계 {num(monthPayments.reduce((a, p) => a + p.amount, 0))}원</span>}>
          <div className="mb-3 flex items-center gap-2">
            <Link href={`/payments?view=received&month=${prev}`} className="btn-secondary btn-sm">◀ 이전 달</Link>
            <Link href={`/payments?view=received&month=${next}`} className="btn-secondary btn-sm">다음 달 ▶</Link>
          </div>
          <PaymentsTable
            payments={monthPayments}
            charges={chargeMap}
            who={(p) => who(p.contract_id)}
            cancel={
              can.admin
                ? (p) => (
                    <ActionButton action={deletePaymentAction.bind(null, p.id)} className="btn-ghost !text-red-600 text-xs" confirm={`${fmtDate(p.paid_date)} ${num(p.amount)}원 입금을 취소할까요?`}>
                      취소
                    </ActionButton>
                  )
                : undefined
            }
          />
        </Card>
      )}
    </div>
  );
}
