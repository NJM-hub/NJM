import { describe, expect, it } from "vitest";
import { alertLevel, buildAlerts, dashboard, dDayLabel, monthly, overview } from "@/lib/stats";
import type { InvestmentSummary } from "@/lib/types";

const today = "2026-09-29";

function inv(p: Partial<InvestmentSummary>): InvestmentSummary {
  return {
    id: "i1", investment_no: "INV-1", customer_id: "c1", target_name: "A", executed_on: "2026-09-01",
    principal: 100_000_000, return_rate: 20, expected_total: 120_000_000, repayment_method: "daily",
    period_days: 100, start_on: "2026-09-02", maturity_on: "2026-12-10", status: "active", status_reason: "",
    memo: "", created_at: "2026-09-01T00:00:00Z", updated_at: "", customer_name: "홍", customer_phone: "",
    collected_amount: 70_000_000, remaining_amount: 50_000_000, recovery_rate: 58.33, overdue_amount: 0,
    overdue_count: 0, schedule_count: 100, last_paid_on: null, elapsed_days: 28, remaining_days: 72, ...p,
  };
}

describe("만기·연체 알림", () => {
  it("만기까지 남은 날짜로 등급", () => {
    expect(alertLevel(inv({ maturity_on: "2026-10-06" }), today)).toBe("d7");
    expect(alertLevel(inv({ maturity_on: "2026-10-07" }), today)).toBeNull();
    expect(alertLevel(inv({ maturity_on: "2026-10-02" }), today)).toBe("d3");
    expect(alertLevel(inv({ maturity_on: "2026-09-30" }), today)).toBe("d1");
    expect(alertLevel(inv({ maturity_on: today }), today)).toBe("due");
    expect(alertLevel(inv({ maturity_on: "2026-09-20" }), today)).toBe("overdue");
    expect(alertLevel(inv({ overdue_amount: 1 }), today)).toBe("overdue");
  });

  it("완료·다 받은 건은 알림 없음", () => {
    expect(alertLevel(inv({ status: "completed", maturity_on: today }), today)).toBeNull();
    expect(alertLevel(inv({ remaining_amount: 0, maturity_on: today }), today)).toBeNull();
  });

  it("연체가 먼저, 그다음 만기 가까운 순", () => {
    const a = buildAlerts([
      inv({ id: "x", maturity_on: "2026-10-05" }),
      inv({ id: "y", overdue_amount: 5 }),
      inv({ id: "z", maturity_on: today }),
    ], today);
    expect(a.map((r) => r.inv.id)).toEqual(["y", "z", "x"]);
    expect(dDayLabel(0)).toBe("D-DAY");
    expect(dDayLabel(3)).toBe("D-3");
    expect(dDayLabel(-2)).toBe("D+2");
  });
});

describe("대시보드", () => {
  it("취소 건 제외, 오늘/내일/7일 받을 금액", () => {
    const d = dashboard(
      [inv({ id: "a", overdue_amount: 2_400_000, overdue_count: 2 }), inv({ id: "b", status: "cancelled" }), inv({ id: "c", status: "completed", remaining_amount: 0 })],
      [
        { investment_id: "a", due_date: today, planned_amount: 1_200_000, unpaid_amount: 200_000 },
        { investment_id: "a", due_date: "2026-09-30", planned_amount: 1_200_000, unpaid_amount: 1_200_000 },
        { investment_id: "a", due_date: "2026-10-06", planned_amount: 1_200_000, unpaid_amount: 1_200_000 },
        { investment_id: "b", due_date: today, planned_amount: 9, unpaid_amount: 9 },
      ],
      [{ investment_id: "a", paid_on: today, amount: 1_000_000 }],
      today,
    );
    expect(d.totalPrincipal).toBe(200_000_000);
    expect(d.todayPlanned).toBe(1_200_000);
    expect(d.todayPaid).toBe(1_000_000);
    expect(d.receiveToday).toBe(200_000);
    expect(d.receiveTomorrow).toBe(1_200_000);
    expect(d.receive7).toBe(2_600_000);
    expect(d.overdueAmount).toBe(2_400_000);
    expect(d.overdueCount).toBe(1);
    expect(d.activeCount).toBe(1);
    expect(d.closedCount).toBe(1);
  });
});

describe("월별 통계", () => {
  it("실행·회수·미회수·신규", () => {
    const rows = monthly(
      [
        inv({ id: "a", customer_id: "c1", executed_on: "2026-01-05" }),
        inv({ id: "b", customer_id: "c1", executed_on: "2026-02-10", principal: 50_000_000 }),
        inv({ id: "c", customer_id: "c2", executed_on: "2026-02-20", principal: 10_000_000 }),
      ],
      [{ investment_id: "a", due_date: "2026-02-03", planned_amount: 100, unpaid_amount: 40 }],
      [{ investment_id: "a", paid_on: "2026-02-03", amount: 60 }],
      2026,
    );
    expect(rows).toHaveLength(12);
    expect(rows[1]).toEqual({
      month: "2026-02", executedAmount: 60_000_000, executedCount: 2, newCount: 1,
      collectedAmount: 60, collectedCount: 1, unpaidAmount: 40,
    });
    expect(rows[0].newCount).toBe(1);
  });
});

describe("전체 현황", () => {
  it("가중 평균 수익률", () => {
    const o = overview([inv({ principal: 100, return_rate: 10 }), inv({ id: "b", principal: 300, return_rate: 20 })]);
    expect(o.avgRateWeighted).toBe(17.5);
    expect(o.avgRateSimple).toBe(15);
  });
});
