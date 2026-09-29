import { describe, expect, it } from "vitest";
import { addMonths, allocatePayment, buildSchedule, dueDates, splitAmount } from "@/lib/schedule";
import { maturityOn } from "@/lib/calc";

const start = "2026-09-30";
const end100 = maturityOn(start, 100); // 2027-01-07

describe("회수 예정일", () => {
  it("일일 100일 → 100회, 시작일~만기일", () => {
    const d = dueDates(start, end100, "daily");
    expect(d).toHaveLength(100);
    expect(d[0]).toBe(start);
    expect(d[99]).toBe(end100);
  });

  it("10일 단위 100일 → 10회, 10일째마다, 마지막은 만기일", () => {
    const d = dueDates(start, end100, "every10");
    expect(d).toHaveLength(10);
    expect(d[0]).toBe("2026-10-09");
    expect(d[9]).toBe(end100);
  });

  it("7일 단위 100일 → 15회 (14회 + 만기일 잔여)", () => {
    const d = dueDates(start, end100, "every7");
    expect(d).toHaveLength(15);
    expect(d[13]).toBe("2027-01-05");
    expect(d[14]).toBe(end100);
  });

  it("월 단위", () => {
    const d = dueDates("2026-01-31", "2026-04-30", "monthly");
    expect(d).toEqual(["2026-02-27", "2026-03-30", "2026-04-29", "2026-04-30"]);
  });

  it("만기 일시상환 → 만기일 1회", () => {
    expect(dueDates(start, end100, "bullet")).toEqual([end100]);
  });

  it("말일 보정", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("금액 배분", () => {
  it("나머지는 마지막 회차에", () => {
    expect(splitAmount(100, 3)).toEqual([33, 33, 34]);
  });

  it("1억 20% 일일 100회 → 1회 120만원, 합계 1.2억", () => {
    const rows = buildSchedule({ startOn: start, maturityOn: end100, method: "daily", total: 120_000_000 });
    expect(rows).toHaveLength(100);
    expect(rows[0]).toEqual({ seq: 1, dueDate: start, amount: 1_200_000 });
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(120_000_000);
  });

  it("합계가 항상 총액과 같다", () => {
    const rows = buildSchedule({ startOn: start, maturityOn: end100, method: "every7", total: 123_456_789 });
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(123_456_789);
  });
});

describe("입금 자동 배분", () => {
  const unpaid = [
    { id: "b", seq: 2, due_date: "2026-10-02", unpaid_amount: 100 },
    { id: "a", seq: 1, due_date: "2026-10-01", unpaid_amount: 60 },
    { id: "c", seq: 3, due_date: "2026-10-03", unpaid_amount: 100 },
  ];

  it("오래된 회차부터 채운다", () => {
    expect(allocatePayment(unpaid, 200)).toEqual([
      { scheduleId: "a", amount: 60 },
      { scheduleId: "b", amount: 100 },
      { scheduleId: "c", amount: 40 },
    ]);
  });

  it("남는 금액은 회차 없는 입금으로", () => {
    expect(allocatePayment(unpaid, 300).at(-1)).toEqual({ scheduleId: null, amount: 40 });
  });
});
