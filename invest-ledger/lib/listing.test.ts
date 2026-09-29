import { describe, expect, it } from "vitest";
import { applyListQuery, customerSummaries, matchesSearch, parseListQuery } from "@/lib/listing";
import type { Customer, InvestmentSummary } from "@/lib/types";

const today = "2026-09-29";
function inv(p: Partial<InvestmentSummary>): InvestmentSummary {
  return {
    id: "i", investment_no: "INV-00001", customer_id: "c1", target_name: "A상점", executed_on: "2026-09-01",
    principal: 100, return_rate: 20, expected_total: 120, repayment_method: "daily", period_days: 100,
    start_on: "2026-09-02", maturity_on: "2026-12-10", status: "active", status_reason: "", memo: "",
    created_at: "", updated_at: "", customer_name: "홍길동", customer_phone: "010-1234-5678",
    collected_amount: 0, remaining_amount: 120, recovery_rate: 0, overdue_amount: 0, overdue_count: 0,
    schedule_count: 0, last_paid_on: null, elapsed_days: 0, remaining_days: 0, ...p,
  };
}

describe("검색", () => {
  const r = inv({});
  it("투자번호·대상명·고객명·연락처", () => {
    expect(matchesSearch(r, "inv-00001")).toBe(true);
    expect(matchesSearch(r, "상점")).toBe(true);
    expect(matchesSearch(r, "길동")).toBe(true);
    expect(matchesSearch(r, "01012345678")).toBe(true);
    expect(matchesSearch(r, "5678")).toBe(true);
    expect(matchesSearch(r, "없는사람")).toBe(false);
  });
});

describe("필터·정렬", () => {
  const rows = [
    inv({ id: "a", investment_no: "INV-1", principal: 300, remaining_amount: 10, maturity_on: "2026-10-01" }),
    inv({ id: "b", investment_no: "INV-2", principal: 100, remaining_amount: 90, overdue_amount: 5 }),
    inv({ id: "c", investment_no: "INV-3", status: "completed", remaining_amount: 0 }),
    inv({ id: "d", investment_no: "INV-4", status: "cancelled" }),
  ];
  it("필터별 개수", () => {
    const { counts } = applyListQuery(rows, parseListQuery({}), today);
    expect(counts).toEqual({ all: 3, active: 2, completed: 1, overdue: 1, soon: 1, cancelled: 1 });
  });
  it("미회수금액 많은 순", () => {
    const { rows: out } = applyListQuery(rows, parseListQuery({ sort: "remaining" }), today);
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("투자금액 적은 순 + 만기임박", () => {
    expect(applyListQuery(rows, parseListQuery({ sort: "principal", dir: "asc" }), today).rows[0].id).toBe("c");
    expect(applyListQuery(rows, parseListQuery({ filter: "soon" }), today).rows.map((r) => r.id)).toEqual(["a"]);
  });
  it("잘못된 값은 기본값", () => {
    expect(parseListQuery({ filter: "x", sort: "y", dir: "z" })).toEqual({ q: "", filter: "all", sort: "executed", dir: "desc" });
  });
});

describe("고객별 합계", () => {
  it("취소 제외, 연체 건수", () => {
    const customers: Customer[] = [{ id: "c1", name: "홍", phone: "", memo: "", status: "active", created_at: "" }];
    const [s] = customerSummaries(customers, [
      inv({ principal: 100, collected_amount: 50, remaining_amount: 70, overdue_amount: 1 }),
      inv({ principal: 200, collected_amount: 240, remaining_amount: 0, status: "completed" }),
      inv({ principal: 999, status: "cancelled" }),
    ], today);
    expect(s).toMatchObject({ investmentCount: 2, totalPrincipal: 300, totalCollected: 290, totalRemaining: 70, overdueCount: 1 });
  });
});
