import Link from "next/link";
import { deleteExpenseAction, saveExpenseAction } from "@/app/actions/assets";
import ActionButton from "@/components/ActionButton";
import { ColumnChart } from "@/components/charts";
import SmartForm, { type Field } from "@/components/Form";
import { Badge, Card, Empty, PageHeader, StatCard, Table } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { EXPENSE_CATEGORIES, label, type ExpenseCategory } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { expenseCategoryOptions } from "@/lib/fieldsets";
import { num, won, wonShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ year?: string; property?: string; category?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const { ds, snap: s } = await getSnapshot();
  const year = /^\d{4}$/.test(sp.year ?? "") ? sp.year! : s.today.slice(0, 4);
  const props = s.properties.map((p) => p.property);
  const propIds = new Set(props.map((p) => p.id));
  const all = ds.expenses.filter((e) => (e.property_id ? propIds.has(e.property_id) : true));
  const list = all
    .filter((e) => e.expense_date.startsWith(year))
    .filter((e) => !sp.property || (sp.property === "common" ? !e.property_id : e.property_id === sp.property))
    .filter((e) => !sp.category || e.category === sp.category)
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  const total = list.reduce((a, e) => a + e.amount, 0);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const byMonth = months.map((m) => list.filter((e) => e.expense_date.startsWith(m)).reduce((a, e) => a + e.amount, 0));
  const cats = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).filter((c) => list.some((e) => e.category === c));
  const pname = (id: string | null) => (id ? (ds.properties.find((p) => p.id === id)?.name ?? "") : "공통");
  const years = [...new Set(all.map((e) => e.expense_date.slice(0, 4)))].sort().reverse();
  if (!years.includes(year)) years.unshift(year);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { year, property: sp.property, category: sp.category, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/expenses?${p}`;
  };
  const propOptions = [...props.map((p) => ({ value: p.id, label: p.name }))];
  const fields = (edit: boolean): Field[] => [
    ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
    { name: "expense_date", label: "날짜", type: "date", required: true },
    { name: "property_id", label: "부동산", type: "select", options: propOptions, hint: "선택 안 함 = 공통 비용" },
    { name: "category", label: "구분", type: "select", required: true, options: expenseCategoryOptions },
    { name: "amount", label: "금액", type: "money", required: true },
    { name: "vendor", label: "거래처" },
    { name: "memo", label: "메모" },
    ...(edit ? [] : [{ name: "repeat_months", label: "매월 반복 (개월 수)", suffix: "개월", hint: "관리비처럼 매달 같은 비용이면 12" } as Field]),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="💳 비용관리" desc="대출이자·재산세·종부세·관리비·전기·수도·보험·수선비·중개수수료·법무비용·청소비 등. 월별/연도별 자동 집계" />
      <div className="flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <Link key={y} href={qs({ year: y })} className={`rounded-full px-3 py-1 text-sm font-medium ${y === year ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {y}년
          </Link>
        ))}
        <form className="flex flex-wrap gap-2" action="/expenses">
          <input type="hidden" name="year" value={year} />
          <select name="property" defaultValue={sp.property ?? ""} className="input !w-auto !py-1.5">
            <option value="">전체 부동산</option>
            <option value="common">공통 비용</option>
            {props.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={sp.category ?? ""} className="input !w-auto !py-1.5">
            <option value="">전체 구분</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn-secondary !py-1.5">보기</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={`${year}년 비용 합계`} value={wonShort(total)} sub={`${list.length}건`} />
        <StatCard label="월평균" value={wonShort(total / Math.max(1, year === s.today.slice(0, 4) ? Number(s.today.slice(5, 7)) : 12))} />
        <StatCard label="대출이자" value={wonShort(list.filter((e) => e.category === "loan_interest").reduce((a, e) => a + e.amount, 0))} />
        <StatCard label="세금 (재산세·종부세)" value={wonShort(list.filter((e) => e.category === "property_tax" || e.category === "comprehensive_tax").reduce((a, e) => a + e.amount, 0))} />
      </div>

      {can.editAssets && (
        <Card title="비용 등록">
          <SmartForm action={saveExpenseAction} cols={4} resetOnSuccess submitLabel="등록" initial={{ expense_date: s.today, category: "repair", repeat_months: "1" }} sections={[{ fields: fields(false) }]} />
        </Card>
      )}

      <Card title="월별 비용">
        <ColumnChart labels={months.map((m) => `${Number(m.slice(5))}월`)} series={[{ name: "비용", values: byMonth }]} fmt={won} wide />
      </Card>

      <Card title="구분별 · 월별 집계">
        {cats.length === 0 ? (
          <Empty>비용이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>구분</th>
                {months.map((m) => (
                  <th key={m} className="num">
                    {Number(m.slice(5))}월
                  </th>
                ))}
                <th className="num">합계</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => {
                const vals = months.map((m) => list.filter((e) => e.category === c && e.expense_date.startsWith(m)).reduce((a, e) => a + e.amount, 0));
                return (
                  <tr key={c}>
                    <td className="font-medium">{EXPENSE_CATEGORIES[c]}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`num text-xs ${v ? "" : "text-slate-300"}`}>
                        {v ? num(v / 1e4) : "-"}
                      </td>
                    ))}
                    <td className="num font-semibold">{num(vals.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td>합계</td>
                {byMonth.map((v, i) => (
                  <td key={i} className="num text-xs">
                    {v ? num(v / 1e4) : "-"}
                  </td>
                ))}
                <td className="num">{num(total)}</td>
              </tr>
            </tfoot>
          </Table>
        )}
        <p className="mt-2 text-xs text-slate-500">월별 칸은 만원 단위, 합계는 원 단위</p>
      </Card>

      <Card title="비용 내역">
        {list.length === 0 ? (
          <Empty>비용이 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>부동산</th>
                <th>구분</th>
                <th className="num">금액</th>
                <th>거래처</th>
                <th>메모</th>
                {can.editAssets && <th />}
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.expense_date)}</td>
                  <td>{pname(e.property_id)}</td>
                  <td>
                    <Badge tone={e.category === "loan_interest" ? "blue" : "gray"}>{label(EXPENSE_CATEGORIES, e.category)}</Badge>
                  </td>
                  <td className="num font-semibold">{num(e.amount)}</td>
                  <td>{e.vendor}</td>
                  <td className="max-w-56 truncate text-slate-500">{e.memo}</td>
                  {can.editAssets && (
                    <td>
                      <details>
                        <summary className="btn-ghost cursor-pointer text-xs">수정</summary>
                        <div className="mt-2 w-[min(90vw,640px)] whitespace-normal">
                          <SmartForm action={saveExpenseAction} cols={2} initial={{ ...(e as unknown as Record<string, string>), property_id: e.property_id ?? "" }} sections={[{ fields: fields(true) }]} />
                          <div className="mt-2">
                            <ActionButton action={deleteExpenseAction.bind(null, e.id)} className="btn-ghost text-xs !text-red-600" confirm="삭제할까요?">
                              삭제
                            </ActionButton>
                          </div>
                        </div>
                      </details>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
