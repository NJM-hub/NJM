import { importExcelAction } from "@/app/actions/importExcel";
import { BarList, ColumnChart, LineChart } from "@/components/charts";
import ImportForm from "@/components/ImportForm";
import { Card, PageHeader, Tabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";
import { shortMonthLabel } from "@/lib/dates";
import { EXPORT_KINDS } from "@/lib/excel";
import { pct, won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { can } = await requirePage();
  const { tab = "charts" } = await searchParams;
  const { snap: s } = await getSnapshot();
  const labels = s.monthly.map((m) => shortMonthLabel(m.month));
  const sum = (k: "billed" | "collected" | "expenses" | "interest" | "net") => s.monthly.reduce((a, m) => a + m[k], 0);

  return (
    <div className="space-y-4">
      <PageHeader title="📈 통계 / 리포트" desc="최근 12개월 추이 · 엑셀 내보내기/가져오기" />
      <Tabs base="/reports" active={tab} tabs={[{ key: "charts", label: "그래프" }, { key: "excel", label: "엑셀" }]} />

      {tab === "charts" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(
              [
                ["12개월 청구", sum("billed")],
                ["12개월 입금", sum("collected")],
                ["12개월 운영비", sum("expenses")],
                ["12개월 이자", sum("interest")],
                ["12개월 순현금", sum("net")],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="card card-body">
                <div className="text-xs text-slate-500">{k}</div>
                <div className={`mt-1 text-xl font-extrabold tabular-nums ${v < 0 ? "text-red-600" : ""}`}>{wonShort(v)}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="월 임대수익 (청구 · 입금)">
              <ColumnChart labels={labels} series={[{ name: "청구", values: s.monthly.map((m) => m.billed) }, { name: "입금", values: s.monthly.map((m) => m.collected) }]} fmt={won} />
            </Card>
            <Card title="월 순수익 (입금 - 비용 - 이자)">
              <ColumnChart labels={labels} series={[{ name: "순현금흐름", values: s.monthly.map((m) => m.net) }]} fmt={won} />
            </Card>
            <Card title="월 비용 (운영비 · 대출이자)">
              <ColumnChart labels={labels} series={[{ name: "운영비", values: s.monthly.map((m) => m.expenses) }, { name: "대출이자", values: s.monthly.map((m) => m.interest) }]} fmt={won} />
            </Card>
            <Card title="대출잔액">
              <LineChart labels={labels} values={s.monthly.map((m) => m.loanBalance)} name="대출잔액" fmt={won} />
            </Card>
            <Card title="미수금 (월말 기준)">
              <LineChart labels={labels} values={s.monthly.map((m) => m.outstanding)} name="미수금" fmt={won} color="#e34948" />
            </Card>
            <Card title="공실률">
              <LineChart labels={labels} values={s.monthly.map((m) => Number(m.vacancyRate.toFixed(1)))} name="공실률" fmt={(v) => pct(v)} axisFmt={(v) => `${Math.round(v)}%`} color="#eb6834" />
            </Card>
          </div>
          <Card title="부동산별 수익률 (자기자본 수익률)">
            <BarList items={[...s.properties].sort((a, b) => (b.leveragedYield ?? -99) - (a.leveragedYield ?? -99)).map((p) => ({ label: p.property.name, value: p.leveragedYield ?? 0, sub: `단순 ${pct(p.simpleYield)} · 현금 ${pct(p.cashYield)}` }))} fmt={(v) => pct(v, 2)} />
          </Card>
        </>
      )}

      {tab === "excel" && (
        <>
          <Card title="엑셀 내보내기">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(EXPORT_KINDS).map(([k, v]) => (
                <a key={k} href={`/api/export/${k}`} className={k === "all" ? "btn" : "btn-secondary"}>
                  ⬇ {v}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">현재 &apos;보기 범위&apos;(전체 통합 / 법인·개인)의 데이터가 내려받아집니다.</p>
          </Card>
          <Card title="엑셀 가져오기 (기존 자료 옮기기)">{can.admin ? <ImportForm action={importExcelAction} /> : <p className="text-sm text-slate-500">관리자만 가져올 수 있습니다.</p>}</Card>
        </>
      )}
    </div>
  );
}
