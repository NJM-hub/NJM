import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { isMonth, monthRange, won } from "@/lib/format";
import { LEDGER_CATEGORIES, loadMonthLedger, type LedgerCategory, type LedgerItem } from "@/lib/settlement/monthlyLedger";
import { addLedgerItem, deleteLedgerItem, updateLedgerItem } from "../actions";

const monthLabel = (m: string) => `${m.slice(2, 4)}년 ${Number(m.slice(5))}월`;
const signed = (n: number) => <span className={n < 0 ? "text-red-600" : ""}>{won(n)}</span>;

function ItemRow({ it, from, to }: { it: LedgerItem; from: string; to: string }) {
  const f = `item-${it.id}`;
  return (
    <tr>
      <td><input form={f} type="date" name="spent_on" defaultValue={it.spent_on ?? ""} min={from} max={to} className="input w-36" /></td>
      <td><input form={f} name="description" defaultValue={it.description} className="input w-full min-w-40" /></td>
      <td className="text-right"><input form={f} name="amount" defaultValue={String(it.amount)} inputMode="numeric" className="input w-32 text-right" /></td>
      <td><input form={f} name="memo" defaultValue={it.memo ?? ""} className="input w-full min-w-32" /></td>
      <td className="whitespace-nowrap">
        <form id={f} action={updateLedgerItem} className="inline">
          <input type="hidden" name="month" value={it.month} />
          <input type="hidden" name="id" value={it.id} />
          <input type="hidden" name="category" value={it.category} />
          <button className="btn-secondary">저장</button>
        </form>
        <form action={deleteLedgerItem} className="ml-1 inline">
          <input type="hidden" name="month" value={it.month} />
          <input type="hidden" name="id" value={it.id} />
          <button className="btn-secondary text-red-600">삭제</button>
        </form>
      </td>
    </tr>
  );
}

function Section({ month, category, label, items, total, manual }: {
  month: string; category: LedgerCategory; label: string; items: LedgerItem[]; total: number; manual: number | null;
}) {
  const { from, to } = monthRange(month);
  const f = `add-${category}`;
  return (
    <div className="card overflow-x-auto !p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <div className="font-semibold">{label}</div>
        <div className="text-sm">합계 <b>{won(total)}</b></div>
      </div>
      {manual != null && (
        <p className="px-4 pt-1 text-xs text-amber-700">
          정산표에 직접 입력한 {won(manual)}이 쓰이고 있습니다. 상세 내역을 추가하면 상세 합계로 바뀝니다.
        </p>
      )}
      <table className="table mt-2">
        <thead>
          <tr><th className="w-40">날짜</th><th>내용</th><th className="text-right">금액</th><th>메모</th><th /></tr>
        </thead>
        <tbody>
          {items.map((it) => <ItemRow key={it.id} it={it} from={from} to={to} />)}
          <tr className="bg-gray-50">
            <td><input form={f} type="date" name="spent_on" min={from} max={to} className="input w-36" /></td>
            <td><input form={f} name="description" placeholder="내용" required className="input w-full min-w-40" /></td>
            <td className="text-right"><input form={f} name="amount" placeholder="0" inputMode="numeric" required className="input w-32 text-right" /></td>
            <td><input form={f} name="memo" placeholder="메모" className="input w-full min-w-32" /></td>
            <td>
              <form id={f} action={addLedgerItem}>
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="category" value={category} />
                <button className="btn whitespace-nowrap">추가</button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function MonthLedgerPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!isMonth(month)) notFound();
  const { supabase } = await requireOwner();
  const r = await loadMonthLedger(supabase, month);
  const { data: led } = await supabase.from("monthly_ledger").select("*").eq("month", month).maybeSingle();
  const totals: Record<LedgerCategory, number> = { installment: r.installment, withholding: r.cashExpense, cash: r.cashSpend, office: r.officeExpense };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link href="/admin/settlement" className="text-sm text-blue-700 underline">← 정산표</Link>
        <h1 className="page-title">{monthLabel(month)} 지출 상세</h1>
      </div>

      <div className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><div className="text-gray-500">KKday 부가세 제외</div><b>{won(r.kkdayNet)}</b></div>
        <div><div className="text-gray-500">비용</div><b>{won(r.cost)}</b></div>
        <div><div className="text-gray-500">기사 지급(세액포함)</div><b>{won(r.driverPay)}</b></div>
        {LEDGER_CATEGORIES.map((c) => (
          <div key={c.key}><div className="text-gray-500">{c.label}</div><b>{won(totals[c.key])}</b></div>
        ))}
        <div><div className="text-gray-500">남은 차액</div><b>{signed(r.remain)}</b></div>
      </div>

      {LEDGER_CATEGORIES.map((c) => {
        const items = r.items.filter((i) => i.category === c.key);
        const manual = !items.length && led?.[c.column] ? (led[c.column] as number) : null;
        return <Section key={c.key} month={month} category={c.key} label={c.label} items={items} total={totals[c.key]} manual={manual} />;
      })}
    </div>
  );
}
