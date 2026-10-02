import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteLoanTxAction, loanTxAction } from "@/app/actions/assets";
import ActionButton from "@/components/ActionButton";
import SmartForm from "@/components/Form";
import { Badge, Card, InfoGrid, Notice, PageHeader, StatCard, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { RATE_TYPES, REPAYMENT_TYPES, label } from "@/lib/constants";
import { getCalcSettings } from "@/lib/data";
import { q, q1 } from "@/lib/db";
import { daysBetween, fmtDate, todayKST } from "@/lib/dates";
import { expectedMonthlyPayment, monthlyInterest } from "@/lib/engine";
import { num, won, wonShort } from "@/lib/format";
import type { Loan, LoanTx } from "@/lib/types";

export const dynamic = "force-dynamic";

const TX = { principal: "원금 상환", interest: "이자 납부", rate_change: "금리 변경" } as const;

export default async function LoanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { can } = await requirePage();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const l = await q1<Loan & { property_name: string }>("select l.*, p.name as property_name from loans l join properties p on p.id = l.property_id where l.id = $1", [id]);
  if (!l) notFound();
  const [txs, settings] = await Promise.all([q<LoanTx>("select * from loan_transactions where loan_id = $1 order by tx_date desc, created_at desc", [id]), getCalcSettings()]);
  const today = todayKST();
  const mi = monthlyInterest(l.balance, l.interest_rate, settings.interestMethod, today);
  const repaid = l.principal - l.balance;
  const left = l.maturity_date ? daysBetween(today, l.maturity_date) : null;
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${l.lender} ${l.product ?? ""}`}
        desc={
          <span>
            <Link href={`/properties/${l.property_id}?tab=loans`} className="link">{l.property_name}</Link> · {label(RATE_TYPES, l.rate_type)} · {label(REPAYMENT_TYPES, l.repayment_type)} {l.is_closed && <Badge>상환 완료</Badge>}
          </span>
        }
        actions={can.editAssets && <Link href={`/loans/${id}/edit`} className="btn-secondary">수정</Link>}
      />
      {saved && <Notice tone="green">저장되었습니다.</Notice>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="현재 잔액" value={wonShort(l.balance)} sub={`원금 ${wonShort(l.principal)} · 상환 ${wonShort(repaid)}`} />
        <StatCard label="금리" value={`${l.interest_rate}%`} sub={label(RATE_TYPES, l.rate_type)} />
        <StatCard label="월 이자" value={won(mi)} sub={`연 ${won(mi * 12)}`} />
        <StatCard label="만기" value={left != null ? (left >= 0 ? `D-${left}` : "만기 지남") : "-"} sub={fmtDate(l.maturity_date)} tone={left != null && left <= 90 ? "orange" : "gray"} />
      </div>
      <Card title="대출 정보">
        <InfoGrid
          cols={4}
          items={[
            ["금융기관", l.lender],
            ["대출상품", l.product],
            ["대출 실행일", fmtDate(l.start_date)],
            ["만기일", fmtDate(l.maturity_date)],
            ["대출원금", won(l.principal)],
            ["현재 잔액", won(l.balance)],
            ["상환방식", label(REPAYMENT_TYPES, l.repayment_type)],
            ["월 상환금 (예상)", won(expectedMonthlyPayment(l, today, settings.interestMethod))],
            ["이자 납부일", l.interest_day ? `매월 ${l.interest_day}일` : "-"],
            ["연 이자", won(mi * 12)],
          ]}
        />
        {l.memo && <p className="mt-3 text-sm text-slate-600">{l.memo}</p>}
      </Card>
      {can.editAssets && !l.is_closed && (
        <Card title="원금 상환 · 이자 납부 · 금리 변경 기록">
          <SmartForm
            action={loanTxAction}
            cols={4}
            resetOnSuccess
            submitLabel="기록"
            initial={{ loan_id: id, tx_type: "principal", tx_date: today, amount: "", new_rate: String(l.interest_rate) }}
            sections={[
              {
                fields: [
                  { name: "loan_id", type: "hidden" },
                  { name: "tx_type", label: "구분", type: "select", required: true, options: Object.entries(TX).map(([value, label]) => ({ value, label })) },
                  { name: "tx_date", label: "날짜", type: "date", required: true },
                  { name: "amount", label: "금액 (원금상환·이자)", type: "money", hint: `이번 달 이자 약 ${num(mi)}원` },
                  { name: "new_rate", label: "새 금리 (금리 변경 시)", suffix: "%" },
                  { name: "memo", label: "메모", span: 2 },
                ],
              },
            ]}
          />
          <p className="mt-2 text-xs text-slate-500">원금 상환 → 잔액 자동 감소 · 이자 납부 → 비용관리에 &apos;대출이자&apos;로 자동 등록 · 금리 변경 → 이후 월 이자 자동 재계산</p>
        </Card>
      )}
      <Card title="거래 기록">
        <Table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>구분</th>
              <th className="num">금액</th>
              <th>내용</th>
              {can.admin && <th />}
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.tx_date)}</td>
                <td>
                  <Badge tone={t.tx_type === "principal" ? "green" : t.tx_type === "interest" ? "gray" : "orange"}>{TX[t.tx_type]}</Badge>
                </td>
                <td className="num">{t.tx_type === "rate_change" ? `${t.new_rate}%` : num(t.amount)}</td>
                <td className="text-slate-500">{t.memo}</td>
                {can.admin && (
                  <td>
                    <ActionButton action={deleteLoanTxAction.bind(null, t.id)} className="btn-ghost text-xs !text-red-600" confirm="이 기록을 취소할까요?">
                      취소
                    </ActionButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
