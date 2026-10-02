// 여러 화면에서 쓰는 표·패널 (서버 컴포넌트)
import Link from "next/link";
import { Badge, Empty, InfoGrid, Table, type Tone } from "@/components/ui";
import { DOCUMENT_CATEGORIES, EFFECTIVE_STATUS, PAYMENT_METHODS, RATE_TYPES, REPAYMENT_TYPES, label, type EffectiveStatus } from "@/lib/constants";
import { fmtDate, monthLabel } from "@/lib/dates";
import { chargeState, monthlyInterest, type ChargeState, type PropertyMetrics } from "@/lib/engine";
import { num, pct, won, wonShort } from "@/lib/format";
import type { Charge, DocumentMeta, Loan, Payment } from "@/lib/types";

export const STATUS_TONE: Record<EffectiveStatus, Tone> = {
  planned: "blue",
  active: "green",
  expiring: "orange",
  expired: "gray",
  renewed: "gray",
  terminated: "red",
};

export function StatusBadge({ s }: { s: EffectiveStatus }) {
  return <Badge tone={STATUS_TONE[s]}>{EFFECTIVE_STATUS[s]}</Badge>;
}

const CHARGE_LABEL: Record<ChargeState, [string, Tone]> = {
  paid: ["완납", "green"],
  partial: ["일부 입금", "yellow"],
  overdue: ["미납", "red"],
  scheduled: ["납부 예정", "blue"],
};

export function ChargeBadge({ c, today }: { c: Charge; today: string }) {
  const st = chargeState(c, today);
  const [t, tone] = c.paid_amount > 0 && st === "overdue" ? ["일부 미납", "red" as Tone] : CHARGE_LABEL[st];
  return <Badge tone={tone}>{t}</Badge>;
}

/** 월별 청구 · 입금 · 미납 표 (명령서 5번 표) */
export function ChargesTable({
  charges,
  today,
  who,
}: {
  charges: Charge[];
  today: string;
  who?: (c: Charge) => React.ReactNode;
}) {
  if (!charges.length) return <Empty>청구 내역이 없습니다.</Empty>;
  const sorted = [...charges].sort((a, b) => b.billing_month.localeCompare(a.billing_month) || a.due_date.localeCompare(b.due_date));
  const total = sorted.reduce((s, c) => s + c.amount, 0);
  const paid = sorted.reduce((s, c) => s + c.paid_amount, 0);
  const overdue = sorted.filter((c) => c.due_date < today).reduce((s, c) => s + c.amount - c.paid_amount, 0);
  return (
    <Table>
      <thead>
        <tr>
          <th>청구 월</th>
          {who && <th>임차인 / 호실</th>}
          <th>납부일</th>
          <th className="num">청구액</th>
          <th className="num">입금액</th>
          <th className="num">미납</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => {
          const unpaid = c.amount - c.paid_amount;
          return (
            <tr key={c.id} className={c.due_date < today && unpaid > 0 ? "bg-red-50/40" : ""}>
              <td className="font-medium">{monthLabel(c.billing_month)}</td>
              {who && <td>{who(c)}</td>}
              <td>{fmtDate(c.due_date)}</td>
              <td className="num">{num(c.amount)}</td>
              <td className="num">{num(c.paid_amount)}</td>
              <td className={`num font-semibold ${unpaid > 0 && c.due_date < today ? "text-red-600" : "text-slate-400"}`}>{num(unpaid)}</td>
              <td>
                <ChargeBadge c={c} today={today} />
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="bg-slate-50 font-semibold">
          <td colSpan={who ? 3 : 2}>합계</td>
          <td className="num">{num(total)}</td>
          <td className="num">{num(paid)}</td>
          <td className="num text-red-600" title="납부일이 지난 미납">
            {num(overdue)}
          </td>
          <td className="text-xs font-normal text-slate-500">총 미납 = 청구 - 입금</td>
        </tr>
      </tfoot>
    </Table>
  );
}

export function PaymentsTable({
  payments,
  charges,
  who,
  cancel,
}: {
  payments: Payment[];
  charges: Map<string, Charge>;
  who?: (p: Payment) => React.ReactNode;
  cancel?: (p: Payment) => React.ReactNode;
}) {
  if (!payments.length) return <Empty>입금 내역이 없습니다.</Empty>;
  const sorted = [...payments].sort((a, b) => b.paid_date.localeCompare(a.paid_date) || b.created_at.localeCompare(a.created_at));
  return (
    <Table>
      <thead>
        <tr>
          <th>입금일</th>
          {who && <th>임차인 / 호실</th>}
          <th>청구 월</th>
          <th className="num">입금액</th>
          <th>방법</th>
          <th>메모</th>
          {cancel && <th />}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.id}>
            <td>{fmtDate(p.paid_date)}</td>
            {who && <td>{who(p)}</td>}
            <td className="text-slate-500">{p.charge_id && charges.get(p.charge_id) ? monthLabel(charges.get(p.charge_id)!.billing_month) : "자동 배분"}</td>
            <td className="num font-semibold">{num(p.amount)}</td>
            <td>{label(PAYMENT_METHODS, p.method)}</td>
            <td className="max-w-48 truncate text-slate-500">{p.memo}</td>
            {cancel && <td>{cancel(p)}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function LoansTable({ loans, propertyName }: { loans: Loan[]; propertyName?: (id: string) => string }) {
  if (!loans.length) return <Empty>등록된 대출이 없습니다.</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          {propertyName && <th>부동산</th>}
          <th>금융기관 / 상품</th>
          <th className="num">원금</th>
          <th className="num">잔액</th>
          <th className="num">금리</th>
          <th className="num">월 이자</th>
          <th>상환방식</th>
          <th>만기</th>
        </tr>
      </thead>
      <tbody>
        {loans.map((l) => (
          <tr key={l.id} className={l.is_closed ? "opacity-50" : ""}>
            {propertyName && <td>{propertyName(l.property_id)}</td>}
            <td>
              <Link href={`/loans/${l.id}`} className="link">
                {l.lender}
              </Link>
              <div className="text-xs text-slate-500">{l.product}</div>
            </td>
            <td className="num">{wonShort(l.principal)}</td>
            <td className="num font-semibold">{wonShort(l.balance)}</td>
            <td className="num">
              {l.interest_rate}% <span className="text-xs text-slate-500">{label(RATE_TYPES, l.rate_type)}</span>
            </td>
            <td className="num">{won(monthlyInterest(l.balance, l.interest_rate))}</td>
            <td>{label(REPAYMENT_TYPES, l.repayment_type)}</td>
            <td>{l.is_closed ? <Badge>상환 완료</Badge> : fmtDate(l.maturity_date)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** 부동산별 손익계산 (명령서 13번) */
export function ProfitStatement({ p, equityFormula }: { p: PropertyMetrics; equityFormula: string }) {
  const rows: [string, number, string?][] = [
    ["매입가격", p.property.purchase_price],
    ["취득비용 + 리모델링 + 기타", p.investedTotal - p.property.purchase_price],
    ["대출 (잔액)", p.loanBalance],
    ["보증금 (현재 계약)", p.deposits],
    ["자기자본", p.equity, equityFormula],
  ];
  const monthly: [string, number, string][] = [
    ["월세", p.monthlyRent, "+"],
    ["기타 임대수입 (관리비 등)", p.otherIncome, "+"],
    ["월 대출이자", p.monthlyInterest, "-"],
    ["월 운영비 (최근 12개월 평균)", p.monthlyOpex, "-"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-sm font-bold text-navy-900">투자 구조</div>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([k, v, hint]) => (
            <div key={k} className={`flex justify-between gap-2 ${k === "자기자본" ? "border-t border-slate-200 pt-1.5 font-bold" : ""}`}>
              <dt className="text-slate-600">
                {k}
                {hint && <span className="block text-[11px] font-normal text-slate-400">= {hint}</span>}
              </dt>
              <dd className="tabular-nums">{won(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-sm font-bold text-navy-900">월 손익</div>
        <dl className="space-y-1.5 text-sm">
          {monthly.map(([k, v, sign]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-slate-600">{k}</dt>
              <dd className={`tabular-nums ${sign === "-" ? "text-red-600" : ""}`}>
                {sign === "-" ? "- " : ""}
                {won(v)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-slate-200 pt-1.5 text-base font-extrabold">
            <dt>예상 월 순수익</dt>
            <dd className={`tabular-nums ${p.monthlyNet < 0 ? "text-red-600" : "text-emerald-700"}`}>{won(p.monthlyNet)}</dd>
          </div>
          <div className="flex justify-between gap-2 font-bold">
            <dt>예상 연 순수익</dt>
            <dd className="tabular-nums">{won(p.annualNet)}</dd>
          </div>
        </dl>
      </div>
      <div className="lg:col-span-2">
        <InfoGrid
          cols={4}
          items={[
            ["단순 임대수익률", <span key="a" title="연간 임대수익 ÷ 매입가격 × 100">{pct(p.simpleYield, 2)}</span>],
            ["대출이자 반영 수익률 (자기자본)", <span key="b" className={(p.leveragedYield ?? 0) < 0 ? "text-red-600" : ""}>{pct(p.leveragedYield, 2)}</span>],
            ["실제 현금수익률 (최근 12개월)", <span key="c" className={(p.cashYield ?? 0) < 0 ? "text-red-600" : ""}>{pct(p.cashYield, 2)}</span>],
            ["최근 12개월 실제 현금흐름", won(p.actualCashflow12m)],
          ]}
        />
        <p className="mt-3 text-xs leading-5 text-slate-500">
          단순 임대수익률 = 연간 임대수익 ÷ 매입가격 × 100 · 대출이자 반영 수익률 = (연간 임대수익 - 연간 이자 - 연간 운영비) ÷ 자기자본 × 100 · 실제 현금수익률 = 최근 12개월 실제 현금흐름(받은 월세 - 쓴 비용·이자) ÷ 실제 투입 자기자본({wonShort(p.actualEquity)}: 투자 총액 - 대출 원금 + 갚은 원금 - 보증금) × 100
        </p>
      </div>
    </div>
  );
}

export function DocumentsTable({ docs, canDelete, remove }: { docs: DocumentMeta[]; canDelete: boolean; remove?: (d: DocumentMeta) => React.ReactNode }) {
  if (!docs.length) return <Empty>저장된 문서가 없습니다.</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <th>구분</th>
          <th>파일</th>
          <th className="num">크기</th>
          <th>올린 날</th>
          {canDelete && <th />}
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id}>
            <td>
              <Badge tone="blue">{label(DOCUMENT_CATEGORIES, d.category)}</Badge>
            </td>
            <td>
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="link">
                {d.title || d.file_name}
              </a>
              {d.title && <div className="text-xs text-slate-500">{d.file_name}</div>}
            </td>
            <td className="num text-xs">{(d.size_bytes / 1024).toFixed(0)}KB</td>
            <td className="text-xs text-slate-500">{d.created_at.slice(0, 10)}</td>
            {canDelete && <td>{remove?.(d)}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
