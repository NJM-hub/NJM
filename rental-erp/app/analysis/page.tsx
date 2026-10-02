import Link from "next/link";
import { BarList } from "@/components/charts";
import { InvestCalc, Simulator } from "@/components/Simulator";
import { Badge, Card, PageHeader, StatCard, Table, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { OWNER_TYPES } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { summarizeByOwner } from "@/lib/engine";
import { pct, won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage();
  const { tab = "property" } = await searchParams;
  const { ds, snap: s } = await getSnapshot();
  const t = s.totals;
  const owners = summarizeByOwner(s);
  const yieldCls = (v: number | null) => (v == null ? "text-slate-400" : v < 0 ? "text-red-600" : v >= 4 ? "text-emerald-700" : "");

  return (
    <div className="space-y-4">
      <PageHeader title="📊 수익분석" desc="부동산별 · 법인/개인별 · 전체 통합 손익과 수익률, 시뮬레이션, 신규 투자 검토" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="월 임대수입" value={wonShort(t.monthlyRent + t.otherIncome)} sub={`월세 ${wonShort(t.monthlyRent)} + 기타 ${wonShort(t.otherIncome)}`} />
        <StatCard label="월 운영비" value={wonShort(t.monthlyOpex)} sub="최근 12개월 평균" />
        <StatCard label="월 대출이자" value={wonShort(t.monthlyInterest)} />
        <StatCard label="월 순수익" value={wonShort(t.monthlyNet)} tone={t.monthlyNet >= 0 ? "green" : "red"} sub={`연 ${wonShort(t.annualNet)}`} />
        <StatCard label="자기자본" value={wonShort(t.equity)} sub={`투자 ${wonShort(t.purchaseTotal)}`} />
        <StatCard label="자기자본 수익률" value={pct(t.leveragedYield)} sub={`임대수익률 ${pct(t.simpleYield)}`} />
      </div>
      <Tabs
        base="/analysis"
        active={tab}
        tabs={[
          { key: "property", label: "부동산별" },
          { key: "owner", label: "법인·개인별" },
          { key: "simulate", label: "시뮬레이션" },
          { key: "invest", label: "투자 의사결정" },
        ]}
      />

      {tab === "property" && (
        <>
          <Card title="부동산별 손익 · 수익률">
            <Table>
              <thead>
                <tr>
                  <th>부동산</th>
                  <th className="num">매입가</th>
                  <th className="num">대출</th>
                  <th className="num">자기자본</th>
                  <th className="num">월 임대수입</th>
                  <th className="num">월 이자</th>
                  <th className="num">월 운영비</th>
                  <th className="num">월 순수익</th>
                  <th className="num">연 순수익</th>
                  <th className="num" title="연간 임대수익 ÷ 매입가격">단순 수익률</th>
                  <th className="num" title="(연 임대수익 - 연 이자 - 연 운영비) ÷ 자기자본">이자반영 수익률</th>
                  <th className="num" title="최근 12개월 실제 현금흐름 ÷ 실제 투입 자기자본">현금 수익률</th>
                </tr>
              </thead>
              <tbody>
                {s.properties.map((p) => (
                  <tr key={p.property.id}>
                    <td>
                      <Link href={`/properties/${p.property.id}?tab=profit`} className="link">
                        {p.property.name}
                      </Link>
                      {p.owner && <div className="text-[11px] text-slate-500">{p.owner.name}</div>}
                    </td>
                    <td className="num">{wonShort(p.property.purchase_price)}</td>
                    <td className="num">{wonShort(p.loanBalance)}</td>
                    <td className="num">{wonShort(p.equity)}</td>
                    <td className="num">{wonShort(p.monthlyRent + p.otherIncome)}</td>
                    <td className="num">{wonShort(p.monthlyInterest)}</td>
                    <td className="num">{wonShort(p.monthlyOpex)}</td>
                    <td className={`num font-bold ${p.monthlyNet < 0 ? "text-red-600" : "text-emerald-700"}`}>{wonShort(p.monthlyNet)}</td>
                    <td className="num">{wonShort(p.annualNet)}</td>
                    <td className="num">{pct(p.simpleYield, 2)}</td>
                    <td className={`num font-semibold ${yieldCls(p.leveragedYield)}`}>{pct(p.leveragedYield, 2)}</td>
                    <td className={`num ${yieldCls(p.cashYield)}`}>{pct(p.cashYield, 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td>전체 통합{t.commonOpex ? <div className="text-[11px] font-normal text-slate-500">공통 비용 월 {wonShort(t.commonOpex)} 포함</div> : null}</td>
                  <td className="num">{wonShort(t.purchaseTotal)}</td>
                  <td className="num">{wonShort(t.loanBalance)}</td>
                  <td className="num">{wonShort(t.equity)}</td>
                  <td className="num">{wonShort(t.monthlyRent + t.otherIncome)}</td>
                  <td className="num">{wonShort(t.monthlyInterest)}</td>
                  <td className="num">{wonShort(t.monthlyOpex)}</td>
                  <td className="num">{wonShort(t.monthlyNet)}</td>
                  <td className="num">{wonShort(t.annualNet)}</td>
                  <td className="num">{pct(t.simpleYield, 2)}</td>
                  <td className="num">{pct(t.leveragedYield, 2)}</td>
                  <td />
                </tr>
              </tfoot>
            </Table>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="자기자본 수익률 순위">
              <BarList
                items={[...s.properties].sort((a, b) => (b.leveragedYield ?? -99) - (a.leveragedYield ?? -99)).map((p) => ({ label: p.property.name, value: p.leveragedYield ?? 0, href: `/properties/${p.property.id}?tab=profit` }))}
                fmt={(v) => pct(v, 2)}
              />
            </Card>
            <Card title="월 순수익 순위">
              <BarList items={[...s.properties].sort((a, b) => b.monthlyNet - a.monthlyNet).map((p) => ({ label: p.property.name, value: p.monthlyNet }))} fmt={wonShort} />
            </Card>
          </div>
        </>
      )}

      {tab === "owner" && (
        <Card title="법인·개인별 수익 (전체 통합 포함)" actions={<span className="text-xs text-slate-500">위쪽 &apos;보기 범위&apos;로 한 소유주만 볼 수도 있습니다</span>}>
          <Table>
            <thead>
              <tr>
                <th>소유주</th>
                <th className="num">부동산</th>
                <th className="num">호실 (공실)</th>
                <th className="num">보증금</th>
                <th className="num">월세</th>
                <th className="num">대출잔액</th>
                <th className="num">월 이자</th>
                <th className="num">월 순수익</th>
                <th className="num">연 순수익</th>
                <th className="num">자기자본</th>
                <th className="num">자기자본 수익률</th>
                <th className="num">미납</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.owner?.id ?? "none"}>
                  <td className="font-semibold">
                    {o.owner?.name ?? "(소유주 미지정)"} {o.owner && <Badge tone={o.owner.owner_type === "corporation" ? "blue" : "gray"}>{OWNER_TYPES[o.owner.owner_type]}</Badge>}
                  </td>
                  <td className="num">{o.propertyCount}</td>
                  <td className="num">
                    {o.unitCount} ({o.vacantUnits})
                  </td>
                  <td className="num">{wonShort(o.deposits)}</td>
                  <td className="num">{wonShort(o.monthlyRent)}</td>
                  <td className="num">{wonShort(o.loanBalance)}</td>
                  <td className="num">{wonShort(o.monthlyInterest)}</td>
                  <td className={`num font-bold ${o.monthlyNet < 0 ? "text-red-600" : "text-emerald-700"}`}>{wonShort(o.monthlyNet)}</td>
                  <td className="num">{wonShort(o.annualNet)}</td>
                  <td className="num">{wonShort(o.equity)}</td>
                  <td className={`num font-semibold ${yieldCls(o.leveragedYield)}`}>{pct(o.leveragedYield, 2)}</td>
                  <td className={`num ${o.unpaid ? "text-red-600" : "text-slate-400"}`}>{o.unpaid ? won(o.unpaid) : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td>전체 통합</td>
                <td className="num">{t.propertyCount}</td>
                <td className="num">
                  {t.unitCount} ({t.vacantUnits})
                </td>
                <td className="num">{wonShort(t.deposits)}</td>
                <td className="num">{wonShort(t.monthlyRent)}</td>
                <td className="num">{wonShort(t.loanBalance)}</td>
                <td className="num">{wonShort(t.monthlyInterest)}</td>
                <td className="num">{wonShort(t.monthlyNet)}</td>
                <td className="num">{wonShort(t.annualNet)}</td>
                <td className="num">{wonShort(t.equity)}</td>
                <td className="num">{pct(t.leveragedYield, 2)}</td>
                <td className="num">{won(t.unpaid)}</td>
              </tr>
            </tfoot>
          </Table>
        </Card>
      )}

      {tab === "simulate" && (
        <Card title="🧮 수익 시뮬레이션">
          <Simulator
            props={s.properties.map((p) => ({ property: { id: p.property.id, name: p.property.name }, monthlyRent: p.monthlyRent, otherIncome: p.otherIncome, monthlyOpex: p.monthlyOpex, equity: p.equity }))}
            loans={ds.loans.filter((l) => s.properties.some((p) => p.property.id === l.property_id))}
            settings={s.settings}
          />
        </Card>
      )}

      {tab === "invest" && (
        <Card title="🏗️ 투자 의사결정 (신규 매입 검토)">
          <InvestCalc />
        </Card>
      )}
    </div>
  );
}
