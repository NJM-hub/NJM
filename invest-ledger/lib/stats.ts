// 대시보드·통계 계산 (순수 함수: DB 조회 결과를 받아 숫자만 계산)
import { addDays, diffDays } from "@/lib/dates";
import type { InvestmentSummary } from "@/lib/types";

export type DueRow = { investment_id: string; due_date: string; planned_amount: number; unpaid_amount: number };
export type PaidRow = { investment_id: string; paid_on: string; amount: number };

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

/** 취소 건은 모든 통계에서 제외 */
export function liveInvestments(rows: InvestmentSummary[]) {
  return rows.filter((r) => r.status !== "cancelled");
}

// ─────────────────────────── 만기·연체 알림 ───────────────────────────

export type AlertLevel = "overdue" | "due" | "d1" | "d3" | "d7";

export const ALERT_LEVELS: Record<AlertLevel, { label: string; icon: string; className: string; rank: number }> = {
  overdue: { label: "연체", icon: "⚠", className: "bg-red-700 text-white ring-red-700", rank: 0 },
  due: { label: "만기일", icon: "●", className: "bg-red-100 text-red-800 ring-red-300", rank: 1 },
  d1: { label: "만기 1일 전", icon: "◆", className: "bg-orange-100 text-orange-800 ring-orange-300", rank: 2 },
  d3: { label: "만기 3일 전", icon: "▲", className: "bg-amber-100 text-amber-900 ring-amber-300", rank: 3 },
  d7: { label: "만기 7일 전", icon: "○", className: "bg-yellow-50 text-yellow-900 ring-yellow-300", rank: 4 },
};

/** 진행 중이고 남은 금액이 있는 투자의 알림 등급 (없으면 null) */
export function alertLevel(inv: InvestmentSummary, today: string): AlertLevel | null {
  if (inv.status !== "active" || inv.remaining_amount <= 0) return null;
  const d = diffDays(today, inv.maturity_on);
  if (inv.overdue_amount > 0 || d < 0) return "overdue";
  if (d === 0) return "due";
  if (d === 1) return "d1";
  if (d <= 3) return "d3";
  if (d <= 7) return "d7";
  return null;
}

export type AlertRow = { inv: InvestmentSummary; level: AlertLevel; dDay: number };

export function buildAlerts(rows: InvestmentSummary[], today: string): AlertRow[] {
  return rows
    .map((inv) => ({ inv, level: alertLevel(inv, today), dDay: diffDays(today, inv.maturity_on) }))
    .filter((a): a is AlertRow => a.level !== null)
    .sort((a, b) => ALERT_LEVELS[a.level].rank - ALERT_LEVELS[b.level].rank || a.dDay - b.dDay);
}

/** 화면 표시용 D-day: D-3, D-DAY, D+2 */
export function dDayLabel(d: number): string {
  return d === 0 ? "D-DAY" : d > 0 ? `D-${d}` : `D+${-d}`;
}

// ─────────────────────────── 대시보드 ───────────────────────────

export function dashboard(
  investments: InvestmentSummary[],
  upcoming: DueRow[], // 오늘 ~ 7일 뒤 예정 회차
  paidToday: PaidRow[],
  today: string,
) {
  const live = liveInvestments(investments);
  const liveIds = new Set(live.map((r) => r.id));
  const due = upcoming.filter((s) => liveIds.has(s.investment_id));
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);

  const overdueRows = live.filter((r) => r.overdue_amount > 0);
  return {
    totalPrincipal: sum(live, (r) => r.principal),
    totalExpected: sum(live, (r) => r.expected_total),
    totalCollected: sum(live, (r) => r.collected_amount),
    totalRemaining: sum(live, (r) => r.remaining_amount),
    todayPlanned: sum(due.filter((s) => s.due_date === today), (s) => s.planned_amount),
    todayPaid: sum(paidToday.filter((p) => liveIds.has(p.investment_id)), (p) => p.amount),
    overdueAmount: sum(overdueRows, (r) => r.overdue_amount),
    overdueCount: overdueRows.length,
    activeCount: live.filter((r) => r.status === "active").length,
    closedCount: live.filter((r) => r.status === "completed").length,
    // 받을 금액 (아직 안 받은 금액 기준)
    receiveToday: sum(due.filter((s) => s.due_date === today), (s) => s.unpaid_amount),
    receiveTomorrow: sum(due.filter((s) => s.due_date === tomorrow), (s) => s.unpaid_amount),
    receive7: sum(due.filter((s) => s.due_date >= today && s.due_date <= in7), (s) => s.unpaid_amount),
  };
}

// ─────────────────────────── 월별 통계 ───────────────────────────

export type MonthRow = {
  month: string; // "2026-09"
  executedAmount: number;
  executedCount: number;
  newCount: number; // 처음 투자한 고객의 투자 건수
  collectedAmount: number;
  collectedCount: number;
  unpaidAmount: number; // 그 달에 예정된 회차 중 아직 못 받은 금액
};

export function monthly(
  investments: InvestmentSummary[],
  schedules: DueRow[],
  repayments: PaidRow[],
  year: number,
): MonthRow[] {
  const live = liveInvestments(investments);
  const liveIds = new Set(live.map((r) => r.id));

  // 고객별 첫 투자
  const firstByCustomer = new Map<string, InvestmentSummary>();
  for (const r of [...live].sort((a, b) => a.executed_on.localeCompare(b.executed_on) || a.created_at.localeCompare(b.created_at))) {
    if (!firstByCustomer.has(r.customer_id)) firstByCustomer.set(r.customer_id, r);
  }
  const firstIds = new Set([...firstByCustomer.values()].map((r) => r.id));

  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inMonth = (d: string) => d.startsWith(month);
    const exec = live.filter((r) => inMonth(r.executed_on));
    const paid = repayments.filter((p) => liveIds.has(p.investment_id) && inMonth(p.paid_on));
    const sched = schedules.filter((s) => liveIds.has(s.investment_id) && inMonth(s.due_date));
    return {
      month,
      executedAmount: sum(exec, (r) => r.principal),
      executedCount: exec.length,
      newCount: exec.filter((r) => firstIds.has(r.id)).length,
      collectedAmount: sum(paid, (p) => p.amount),
      collectedCount: paid.length,
      unpaidAmount: sum(sched, (s) => s.unpaid_amount),
    };
  });
}

// ─────────────────────────── 전체 현황 ───────────────────────────

export function overview(investments: InvestmentSummary[]) {
  const live = liveInvestments(investments);
  const active = live.filter((r) => r.status === "active");
  const overdue = live.filter((r) => r.overdue_amount > 0);
  const principal = sum(live, (r) => r.principal);
  const expected = sum(live, (r) => r.expected_total);
  const collected = sum(live, (r) => r.collected_amount);

  const byStatus = (["active", "completed", "suspended", "cancelled"] as const).map((status) => {
    const rows = investments.filter((r) => r.status === status);
    return {
      status,
      count: rows.length,
      principal: sum(rows, (r) => r.principal),
      remaining: sum(rows, (r) => r.remaining_amount),
    };
  });

  const methods = new Map<string, { count: number; principal: number; remaining: number }>();
  for (const r of live) {
    const m = methods.get(r.repayment_method) ?? { count: 0, principal: 0, remaining: 0 };
    m.count++;
    m.principal += r.principal;
    m.remaining += r.remaining_amount;
    methods.set(r.repayment_method, m);
  }

  return {
    count: live.length,
    principal,
    expected,
    collected,
    remaining: sum(live, (r) => r.remaining_amount),
    recoveryRate: expected ? Math.round((collected / expected) * 10000) / 100 : 0,
    /** 투자금액으로 가중한 평균 수익률 */
    avgRateWeighted: principal ? Math.round((sum(live, (r) => r.principal * r.return_rate) / principal) * 100) / 100 : 0,
    /** 건별 단순 평균 수익률 */
    avgRateSimple: live.length ? Math.round((sum(live, (r) => r.return_rate) / live.length) * 100) / 100 : 0,
    activePrincipal: sum(active, (r) => r.principal),
    activeRemaining: sum(active, (r) => r.remaining_amount),
    activeCount: active.length,
    overduePrincipal: sum(overdue, (r) => r.principal),
    overdueRemaining: sum(overdue, (r) => r.remaining_amount),
    overdueAmount: sum(overdue, (r) => r.overdue_amount),
    overdueCount: overdue.length,
    byStatus,
    byMethod: [...methods.entries()].map(([method, v]) => ({ method, ...v })),
  };
}
