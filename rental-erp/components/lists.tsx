// 미납·만료·공실 목록 (대시보드와 각 화면에서 함께 사용)
import Link from "next/link";
import { Badge, Empty, type Tone } from "@/components/ui";
import { fmtDate, monthLabel } from "@/lib/dates";
import type { ArrearItem, ExpiringItem, Snapshot, UnitView } from "@/lib/engine";
import { won, wonShort } from "@/lib/format";

export function where(p: { name: string } | null | undefined, u: { unit_no: string; dong?: string | null } | null | undefined) {
  return [p?.name, u?.dong ? `${u.dong}동` : null, u?.unit_no].filter(Boolean).join(" ");
}

export function agingTone(days: number): Tone {
  if (days > 90) return "red";
  if (days > 60) return "orange";
  if (days > 30) return "orange";
  return "yellow";
}

export function ArrearsList({ items, limit }: { items: ArrearItem[]; limit?: number }) {
  if (!items.length) return <Empty>미납이 없습니다 👍</Empty>;
  const list = limit ? items.slice(0, limit) : items;
  return (
    <ul className="divide-y divide-slate-100">
      {list.map((a) => {
        const months = a.charges.map((c) => monthLabel(c.charge.billing_month).replace(/^\d+년 /, "")).join("·");
        return (
          <li key={a.contract.id} className={`py-2.5 ${a.days > 90 ? "-mx-2 rounded-lg bg-red-50/70 px-2" : ""}`}>
            <Link href={`/contracts/${a.contract.id}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {a.tenant?.name} <span className="font-normal text-slate-500">/ {where(a.property, a.unit)}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {months} 월세 미납 · 미납기간 {a.days}일
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-bold tabular-nums ${a.days > 90 ? "text-red-700" : "text-red-600"}`}>{won(a.total)}</div>
                <Badge tone={agingTone(a.days)}>{a.bucket}</Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const dot = { red: "🔴", orange: "🟠", yellow: "🟡" } as const;

export function ExpiringList({ items, limit }: { items: ExpiringItem[]; limit?: number }) {
  if (!items.length) return <Empty>90일 안에 끝나는 계약이 없습니다.</Empty>;
  const list = limit ? items.slice(0, limit) : items;
  return (
    <ul className="divide-y divide-slate-100">
      {list.map((e) => (
        <li key={e.contract.id} className="py-2.5">
          <Link href={`/contracts/${e.contract.id}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm">
              <span aria-hidden>{dot[e.level]}</span> <span className="font-semibold">{e.tenant?.name}</span>
              <span className="text-slate-500"> / {where(e.property, e.unit)}</span>
            </div>
            <div className="shrink-0 text-right text-xs">
              <div className="font-semibold text-slate-800">{fmtDate(e.contract.end_date)} 만료</div>
              <div className={e.level === "red" ? "text-red-600" : e.level === "orange" ? "text-orange-600" : "text-amber-600"}>D-{e.daysLeft}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function VacancyList({ items }: { items: UnitView[] }) {
  const v = items.filter((u) => !u.occupied);
  if (!v.length) return <Empty>공실이 없습니다.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {v.map((u) => (
        <li key={u.unit.id} className="py-2.5">
          <Link href={`/properties/${u.property.id}?tab=units`} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{where(u.property, u.unit)}</div>
              <div className="text-xs text-slate-500">
                공실 {u.vacancyDays}일 · 예상 월세 {wonShort(u.unit.expected_rent)}
                {u.upcoming && <span className="ml-1 text-navy-600">· {fmtDate(u.upcoming.start_date)} 입주 예정</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-slate-500">예상 공실손실</div>
              <div className="text-sm font-bold text-orange-600 tabular-nums">{won(u.vacancyLoss)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DepositDueList({ items }: { items: Snapshot["depositsDue"] }) {
  if (!items.length) return <Empty>반환 예정 보증금이 없습니다.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((d) => (
        <li key={d.contract.id} className="py-2.5">
          <Link href={`/contracts/${d.contract.id}?tab=deposit`} className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm">
              <span className="font-semibold">{d.tenant?.name}</span>
              <span className="text-slate-500"> / {where(d.property, d.unit)}</span>
              <div className="text-xs text-slate-500">
                {fmtDate(d.dueDate)} 반환 예정 {d.daysLeft < 0 ? <span className="text-red-600">({-d.daysLeft}일 지남)</span> : `(D-${d.daysLeft})`}
              </div>
            </div>
            <div className="shrink-0 text-sm font-bold tabular-nums">{won(d.outstanding)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
