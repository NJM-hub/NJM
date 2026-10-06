import Link from "next/link";
import { saveUnitAction } from "@/app/actions/properties";
import { LineChart } from "@/components/charts";
import SmartForm from "@/components/Form";
import { where } from "@/components/lists";
import { Badge, Card, Empty, PageHeader, StatCard, Table, type Tone } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { fmtDate, shortMonthLabel } from "@/lib/dates";
import { pct, won, wonShort } from "@/lib/format";
import { unitFields } from "@/lib/fieldsets";
import { compareUnits } from "@/lib/views";

export const dynamic = "force-dynamic";

const BUCKETS = [
  { key: "30", label: "30일 이하", test: (d: number) => d <= 30, tone: "yellow" },
  { key: "90", label: "31~90일", test: (d: number) => d > 30 && d <= 90, tone: "orange" },
  { key: "90+", label: "90일 초과", test: (d: number) => d > 90, tone: "red" },
] as const satisfies readonly { key: string; label: string; test: (d: number) => boolean; tone: Tone }[];

const bucketOf = (days: number) => BUCKETS.find((b) => b.test(days))!;
const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${on ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`;

export default async function VacancyPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { can } = await requirePage();
  const { bucket } = await searchParams;
  const { ds, snap: s } = await getSnapshot();
  const t = s.totals;

  const vacant = s.units.filter((u) => !u.occupied).sort((a, b) => compareUnits(ds, a.unit, b.unit));
  const active = BUCKETS.find((b) => b.key === bucket);
  const list = active ? vacant.filter((u) => active.test(u.vacancyDays)) : vacant;
  const lossToDate = vacant.reduce((x, u) => x + u.vacancyLoss, 0);
  const avgDays = vacant.length ? Math.round(vacant.reduce((x, u) => x + u.vacancyDays, 0) / vacant.length) : 0;
  const upcoming = vacant.filter((u) => u.upcoming).length;
  const labels = s.monthly.map((m) => shortMonthLabel(m.month));

  return (
    <div className="space-y-4">
      <PageHeader title="🚪 공실관리" desc="지금 비어 있는 호실과 공실 기간·예상 손실. 공실 시작일은 호실 정보의 '공실 시작일', 없으면 마지막 계약 종료 다음 날 기준." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="공실" value={`${t.vacantUnits}호실`} sub={`전체 ${t.unitCount}호실 · 공실률 ${pct(t.vacancyRate)}`} tone={t.vacantUnits ? "orange" : "green"} href="/vacancy" />
        <StatCard label="월 예상 손실" value={wonShort(t.vacancyLossMonthly)} sub="공실 호실 예상 월세 합계" tone={t.vacancyLossMonthly ? "orange" : "gray"} />
        <StatCard label="누적 공실 손실" value={wonShort(lossToDate)} sub={`평균 공실 ${avgDays}일`} tone={lossToDate ? "red" : "gray"} />
        <StatCard label="입주 예정" value={`${upcoming}호실`} sub="다음 계약이 등록된 공실" tone={upcoming ? "green" : "gray"} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/vacancy" className={chip(!active)}>
          전체 {vacant.length}
        </Link>
        {BUCKETS.map((b) => (
          <Link key={b.key} href={`/vacancy?bucket=${encodeURIComponent(b.key)}`} className={chip(active?.key === b.key)}>
            {b.label} {vacant.filter((u) => b.test(u.vacancyDays)).length}
          </Link>
        ))}
      </div>
      <Card title={active ? `공실 ${active.label}` : "공실 목록"}>
        {list.length === 0 ? (
          <Empty>공실이 없습니다 👍</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>부동산 / 호실</th>
                <th>공실 시작일</th>
                <th className="num">공실기간</th>
                <th className="num">예상 보증금</th>
                <th className="num">예상 월세</th>
                <th className="num">예상 공실손실</th>
                <th>입주 예정</th>
                <th className="w-full" />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const b = bucketOf(u.vacancyDays);
                return (
                  <tr key={u.unit.id} className={u.vacancyDays > 90 ? "bg-red-50" : ""}>
                    <td>
                      <Link href={`/properties/${u.property.id}?tab=units`} className="link">
                        {where(u.property, u.unit)}
                      </Link>
                      {u.unit.memo && <div className="max-w-56 truncate text-xs text-slate-500">{u.unit.memo}</div>}
                    </td>
                    <td>{fmtDate(u.vacancyStart)}</td>
                    <td className="num">
                      <Badge tone={b.tone}>{u.vacancyDays}일</Badge>
                    </td>
                    <td className="num">{wonShort(u.unit.expected_deposit)}</td>
                    <td className="num">{won(u.unit.expected_rent)}</td>
                    <td className="num font-bold text-orange-600">{won(u.vacancyLoss)}</td>
                    <td>
                      {u.upcoming ? (
                        <Link href={`/contracts/${u.upcoming.id}`} className="link text-xs">
                          {fmtDate(u.upcoming.start_date)} 입주
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-start gap-1">
                        {can.editLeasing && !u.upcoming && (
                          <Link href={`/contracts/new?unit=${u.unit.id}`} className="btn-ghost">
                            계약 등록
                          </Link>
                        )}
                        {can.editAssets && (
                          <details>
                            <summary className="btn-ghost cursor-pointer">수정</summary>
                            <div className="mt-2 w-[min(90vw,560px)] whitespace-normal">
                              <SmartForm action={saveUnitAction} cols={2} initial={{ ...(u.unit as unknown as Record<string, string>), inactive: !u.unit.is_active }} sections={[{ fields: unitFields(true) }]} />
                            </div>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {s.monthly.length > 0 && (
        <Card title="월별 공실률">
          <LineChart labels={labels} values={s.monthly.map((m) => Number(m.vacancyRate.toFixed(1)))} name="공실률" fmt={(v) => pct(v)} axisFmt={(v) => `${Math.round(v)}%`} color="#eb6834" />
        </Card>
      )}
    </div>
  );
}
