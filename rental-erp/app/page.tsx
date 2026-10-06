import Link from "next/link";
import { BarList, ColumnChart } from "@/components/charts";
import { ArrearsList, DepositDueList, ExpiringList, VacancyList, where } from "@/components/lists";
import { Card, Empty, Notice, StatCard } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { fmtDate, monthLabel, parts, shortMonthLabel } from "@/lib/dates";
import { pct, won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { user } = await requirePage();
  const { denied } = await searchParams;
  const { snap: s } = await getSnapshot();
  const t = s.totals;
  const [y, m, d] = parts(s.today);

  if (t.propertyCount === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <h1 className="text-2xl font-extrabold text-navy-950">환영합니다, {user.name}님 👋</h1>
        <Notice>
          아직 등록된 부동산이 없습니다. <Link className="link" href="/properties/new">부동산 등록</Link>부터 시작하거나,{" "}
          {user.role === "admin" ? (
            <>
              <Link className="link" href="/settings?tab=data">설정 → 데이터</Link>에서 <b>샘플 데이터</b>를 넣어 먼저 둘러보세요.
            </>
          ) : (
            "관리자에게 문의하세요."
          )}
        </Notice>
      </div>
    );
  }

  const todayItems = [
    { icon: "🔴", label: `미납 ${s.arrears.length}건`, sub: wonShort(t.unpaid), href: "/arrears", tone: s.arrears.length ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-50" },
    { icon: "🟠", label: `계약 만료 ${s.expiring.length}건`, sub: "90일 이내", href: "/contracts?filter=expiring", tone: s.expiring.length ? "text-orange-700 bg-orange-50" : "text-slate-500 bg-slate-50" },
    { icon: "🟡", label: `오늘 월세 입금 예정 ${t.todayDueCount}건`, sub: wonShort(t.todayDue), href: "/payments?view=today", tone: t.todayDueCount ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50" },
    { icon: "💰", label: `오늘 입금액 ${won(t.todayReceived)}`, sub: `${s.today_.receivedPayments.length}건`, href: "/payments?view=received", tone: "text-emerald-700 bg-emerald-50" },
  ];

  const labels = s.monthly.map((x) => shortMonthLabel(x.month));
  const yields = s.properties
    .filter((p) => p.leveragedYield != null)
    .sort((a, b) => b.leveragedYield! - a.leveragedYield!)
    .map((p) => ({ label: p.property.name, value: p.leveragedYield!, sub: `월 ${wonShort(p.monthlyNet)}`, href: `/properties/${p.property.id}?tab=profit` }));

  return (
    <div className="space-y-4 sm:space-y-5">
      {denied && <Notice tone="orange">권한이 없어 대시보드로 돌아왔습니다.</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">
            {y}년 {m}월 {d}일 ({WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})
          </p>
          <h1 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">{user.name}님, 오늘 확인할 사항입니다</h1>
        </div>
        <div className="text-xs text-slate-500">
          부동산 {t.propertyCount}개 · 호실 {t.unitCount}개 · 임대 중 {t.occupiedUnits} · 공실 {t.vacantUnits}
        </div>
      </div>

      {/* 오늘 확인할 사항 (휴대폰에서 가장 위) */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {todayItems.map((it) => (
          <Link key={it.label} href={it.href} className={`rounded-xl px-3 py-2.5 ${it.tone} transition hover:brightness-95`}>
            <div className="text-[13px] font-bold sm:text-sm">
              <span aria-hidden>{it.icon}</span> {it.label}
            </div>
            <div className="text-xs opacity-80">{it.sub}</div>
          </Link>
        ))}
      </div>

      {/* ① ~ ⑥ 대표자가 가장 먼저 보는 숫자 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon="💵" label="① 오늘 받을 돈" value={wonShort(t.todayDue)} sub={`${t.todayDueCount}건 납부일 · 이번 달 남은 청구 ${wonShort(t.monthOutstanding)}`} tone="blue" href="/payments?view=today" />
        <StatCard icon="🔴" label="② 미납금" value={wonShort(t.unpaid)} sub={`${s.arrears.length}명 · 90일 이상 ${s.arrears.filter((a) => a.days > 90).length}명`} tone={t.unpaid > 0 ? "red" : "green"} href="/arrears" />
        <StatCard icon="📅" label="③ 계약 만료 예정" value={`${s.expiring.length}건`} sub={`30일 이내 ${s.expiring.filter((e) => e.level === "red").length}건`} tone={s.expiring.some((e) => e.level === "red") ? "red" : s.expiring.length ? "orange" : "green"} href="/contracts?filter=expiring" />
        <StatCard icon="💰" label={`④ ${m}월 수익`} value={wonShort(t.monthBilled)} sub={`입금 ${wonShort(t.monthCollected)} · 미수 ${wonShort(t.monthOutstanding)}`} href="/payments" />
        <StatCard icon="💳" label="⑤ 월 대출이자" value={wonShort(t.monthlyInterest)} sub={`대출잔액 ${wonShort(t.loanBalance)}`} href="/loans" />
        <StatCard icon="📈" label="⑥ 월 순수익" value={wonShort(t.monthlyNet)} sub={`연 ${wonShort(t.annualNet)}`} tone={t.monthlyNet >= 0 ? "green" : "red"} href="/analysis" />
      </div>

      {/* 전체 현황 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon="🏢" label="총 부동산" value={`${t.propertyCount}개`} sub={`임대 중 ${t.leasedProperties} · 전체 공실 ${t.vacantProperties} · 호실 ${t.unitCount}개`} href="/properties" />
        <StatCard icon="🔐" label="총 보증금" value={wonShort(t.deposits)} sub="현재 계약 기준" />
        <StatCard icon="💵" label="월 임대수익" value={wonShort(t.monthlyRent)} sub={t.otherIncome ? `관리비 등 +${wonShort(t.otherIncome)}` : "월세 합계"} />
        <StatCard icon="🏦" label="대출잔액" value={wonShort(t.loanBalance)} sub={`월 이자 ${wonShort(t.monthlyInterest)}`} href="/loans" />
        <StatCard icon="📊" label="연 예상 순수익" value={wonShort(t.annualNet)} sub={`이자 제외 시 ${wonShort(t.annualNetBeforeInterest)}`} tone={t.annualNet >= 0 ? "gray" : "red"} href="/analysis" />
        <StatCard icon="📐" label="임대수익률" value={pct(t.simpleYield)} sub={`자기자본 수익률 ${pct(t.leveragedYield)}`} href="/analysis" />
        <StatCard icon="🚪" label="공실률" value={pct(t.vacancyRate)} sub={`공실 ${t.vacantUnits}호실 · 월 손실 ${wonShort(t.vacancyLossMonthly)}`} tone={t.vacancyRate > 20 ? "orange" : "gray"} href="/vacancy" />
        <StatCard icon="🧾" label={`${m}월 입금`} value={wonShort(t.monthCollected)} sub={`청구 대비 ${t.monthBilled ? pct((t.monthCollected / t.monthBilled) * 100, 0) : "-"}`} href="/payments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span>🔴 미납 현황</span>} actions={<Link href="/arrears" className="link">전체 보기</Link>}>
          <ArrearsList items={s.arrears} limit={6} />
        </Card>
        <Card title="📅 계약 만료 예정" actions={<Link href="/contracts?filter=expiring" className="link">전체 보기</Link>}>
          <ExpiringList items={s.expiring} limit={6} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="월 임대수익 (청구 · 입금)">
          <ColumnChart
            labels={labels}
            series={[
              { name: "청구", values: s.monthly.map((x) => x.billed) },
              { name: "입금", values: s.monthly.map((x) => x.collected) },
            ]}
            fmt={won}
          />
        </Card>
        <Card title="월 순현금흐름 (입금 - 비용 - 이자)">
          <ColumnChart labels={labels} series={[{ name: "순현금흐름", values: s.monthly.map((x) => x.net) }]} fmt={won} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="부동산별 자기자본 수익률" actions={<Link href="/analysis" className="link">수익분석</Link>}>
          {yields.length ? <BarList items={yields} fmt={(v) => pct(v)} /> : <Empty>매입가격을 입력하면 계산됩니다.</Empty>}
        </Card>
        <Card title="🚪 공실" actions={<Link href="/vacancy" className="link text-xs">월 {wonShort(t.vacancyLossMonthly)} 손실 · 공실관리</Link>}>
          <VacancyList items={s.units} />
        </Card>
        <Card title="🔐 보증금 반환 · 🏦 대출 만기">
          <DepositDueList items={s.depositsDue} />
          {s.loansDue.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
              {s.loansDue.map((l) => (
                <li key={l.loan.id} className="py-2.5">
                  <Link href={`/loans/${l.loan.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      🏦 <b>{l.loan.lender}</b> <span className="text-slate-500">/ {l.property?.name}</span>
                      <span className="block text-xs text-slate-500">
                        {fmtDate(l.loan.maturity_date)} 만기 (D-{l.daysLeft})
                      </span>
                    </span>
                    <b className="tabular-nums">{wonShort(l.loan.balance)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {s.today_.dueCharges.length > 0 && (
        <Card title={`🟡 오늘(${monthLabel(s.month).replace(/^\d+년 /, "")} ${d}일) 월세 납부일`}>
          <ul className="divide-y divide-slate-100">
            {s.today_.dueCharges.map((x) => (
              <li key={x.charge.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/contracts/${x.contract.id}`} className="min-w-0 truncate">
                  <b>{x.tenant?.name}</b> <span className="text-slate-500">/ {where(x.property, x.unit)}</span>
                </Link>
                <b className="tabular-nums">{won(x.unpaid)}</b>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
