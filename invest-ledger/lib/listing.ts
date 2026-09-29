// 투자 목록 검색·필터·정렬, 고객별 합계 (순수 함수)
import { alertLevel } from "@/lib/stats";
import type { Customer, InvestmentSummary } from "@/lib/types";

export const LIST_FILTERS = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "overdue", label: "연체" },
  { value: "soon", label: "만기임박" },
  { value: "cancelled", label: "취소" },
] as const;
export type ListFilter = (typeof LIST_FILTERS)[number]["value"];

export const LIST_SORTS = [
  { value: "executed", label: "투자 실행일" },
  { value: "maturity", label: "만기일" },
  { value: "principal", label: "투자금액" },
  { value: "remaining", label: "미회수금액" },
] as const;
export type ListSort = (typeof LIST_SORTS)[number]["value"];

export type ListQuery = { q: string; filter: ListFilter; sort: ListSort; dir: "asc" | "desc" };

export function parseListQuery(sp: Record<string, string | undefined>): ListQuery {
  const filter = LIST_FILTERS.some((f) => f.value === sp.filter) ? (sp.filter as ListFilter) : "all";
  const sort = LIST_SORTS.some((s) => s.value === sp.sort) ? (sp.sort as ListSort) : "executed";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  return { q: (sp.q ?? "").trim(), filter, sort, dir };
}

const digits = (s: string) => s.replace(/\D/g, "");

/** 투자번호·투자 대상명·고객명·연락처 검색 (연락처는 하이픈 없이도 찾기) */
export function matchesSearch(r: InvestmentSummary, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const d = digits(q);
  return (
    r.investment_no.toLowerCase().includes(needle) ||
    r.target_name.toLowerCase().includes(needle) ||
    r.customer_name.toLowerCase().includes(needle) ||
    (d.length >= 3 && digits(r.customer_phone).includes(d))
  );
}

export function matchesFilter(r: InvestmentSummary, f: ListFilter, today: string): boolean {
  switch (f) {
    case "all":
      return r.status !== "cancelled";
    case "cancelled":
      return r.status === "cancelled";
    case "active":
    case "completed":
      return r.status === f;
    case "overdue":
      return alertLevel(r, today) === "overdue";
    case "soon": {
      const lv = alertLevel(r, today);
      return lv === "due" || lv === "d1" || lv === "d3" || lv === "d7";
    }
  }
}

export function sortRows(rows: InvestmentSummary[], sort: ListSort, dir: "asc" | "desc"): InvestmentSummary[] {
  const key = (r: InvestmentSummary): number | string =>
    sort === "maturity" ? r.maturity_on : sort === "principal" ? r.principal : sort === "remaining" ? r.remaining_amount : r.executed_on;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    const c = ka < kb ? -1 : ka > kb ? 1 : 0;
    return c * sign || b.investment_no.localeCompare(a.investment_no);
  });
}

export function applyListQuery(rows: InvestmentSummary[], q: ListQuery, today: string) {
  const searched = rows.filter((r) => matchesSearch(r, q.q));
  const counts = Object.fromEntries(
    LIST_FILTERS.map((f) => [f.value, searched.filter((r) => matchesFilter(r, f.value, today)).length]),
  ) as Record<ListFilter, number>;
  const filtered = searched.filter((r) => matchesFilter(r, q.filter, today));
  return { rows: sortRows(filtered, q.sort, q.dir), counts };
}

// ─────────────────────────── 고객별 ───────────────────────────

export type CustomerSummary = Customer & {
  investmentCount: number;
  totalPrincipal: number;
  totalCollected: number;
  totalRemaining: number;
  overdueCount: number;
  activeCount: number;
  lastExecutedOn: string | null;
};

/** 고객별 합계 (취소된 투자는 제외) */
export function customerSummaries(customers: Customer[], investments: InvestmentSummary[], today: string): CustomerSummary[] {
  const byCustomer = new Map<string, InvestmentSummary[]>();
  for (const r of investments) {
    if (r.status === "cancelled") continue;
    const list = byCustomer.get(r.customer_id) ?? [];
    list.push(r);
    byCustomer.set(r.customer_id, list);
  }
  return customers.map((c) => {
    const rows = byCustomer.get(c.id) ?? [];
    return {
      ...c,
      investmentCount: rows.length,
      totalPrincipal: rows.reduce((a, r) => a + r.principal, 0),
      totalCollected: rows.reduce((a, r) => a + r.collected_amount, 0),
      totalRemaining: rows.reduce((a, r) => a + r.remaining_amount, 0),
      overdueCount: rows.filter((r) => alertLevel(r, today) === "overdue").length,
      activeCount: rows.filter((r) => r.status === "active").length,
      lastExecutedOn: rows.reduce<string | null>((a, r) => (!a || r.executed_on > a ? r.executed_on : a), null),
    };
  });
}

export function matchesCustomer(c: Customer, q: string): boolean {
  if (!q) return true;
  const d = digits(q);
  return c.name.toLowerCase().includes(q.toLowerCase()) || (d.length >= 3 && digits(c.phone).includes(d));
}
