import Link from "next/link";
import { recordMonthInterestAction } from "@/app/actions/assets";
import ActionButton from "@/components/ActionButton";
import { LineChart } from "@/components/charts";
import { LoansTable } from "@/components/panels";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { fmtDate, shortMonthLabel } from "@/lib/dates";
import { won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const { can } = await requirePage();
  const { ds, snap: s } = await getSnapshot();
  const props = new Set(s.properties.map((p) => p.property.id));
  const loans = ds.loans.filter((l) => props.has(l.property_id)).sort((a, b) => Number(a.is_closed) - Number(b.is_closed) || b.balance - a.balance);
  const live = loans.filter((l) => !l.is_closed);
  const name = (id: string) => ds.properties.find((p) => p.id === id)?.name ?? "";
  const avgRate = live.length ? live.reduce((a, l) => a + l.interest_rate * l.balance, 0) / Math.max(1, live.reduce((a, l) => a + l.balance, 0)) : 0;
  return (
    <div className="space-y-4">
      <PageHeader
        title="🏦 대출관리"
        desc="월 이자 = 대출잔액 × 금리 ÷ 12 (예: 10억 × 5% = 연 5,000만원, 월 약 4,166,667원). 원금상환을 기록하면 잔액이 자동으로 줄어듭니다."
        actions={
          can.editAssets && (
            <>
              <ActionButton action={recordMonthInterestAction} confirm="이번 달 대출이자를 계산해서 비용으로 기록할까요? (이미 기록된 대출은 건너뜀)">
                이번 달 이자 비용 기록
              </ActionButton>
              <Link href="/loans/new" className="btn">+ 대출 등록</Link>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="대출잔액" value={wonShort(s.totals.loanBalance)} sub={`${live.length}건`} />
        <StatCard label="월 이자" value={wonShort(s.totals.monthlyInterest)} sub={`연 ${wonShort(s.totals.monthlyInterest * 12)}`} />
        <StatCard label="평균 금리 (잔액 가중)" value={`${avgRate.toFixed(2)}%`} />
        <StatCard label="가장 가까운 만기" value={s.loansDue[0] ? `D-${s.loansDue[0].daysLeft}` : "-"} sub={s.loansDue[0] ? `${s.loansDue[0].loan.lender} ${fmtDate(s.loansDue[0].loan.maturity_date)}` : "90일 이내 없음"} tone={s.loansDue.length ? "orange" : "gray"} />
      </div>
      <Card title="대출 목록">
        <LoansTable loans={loans} propertyName={name} />
      </Card>
      <Card title="대출잔액 추이">
        <LineChart labels={s.monthly.map((m) => shortMonthLabel(m.month))} values={s.monthly.map((m) => m.loanBalance)} name="대출잔액" fmt={won} wide />
      </Card>
    </div>
  );
}
