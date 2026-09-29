import { describe, expect, it } from "vitest";
import { defaultMaturityOn, defaultStartOn, expectedTotal, installmentCount, recoveryRate } from "./calc";
import { addMonths, diffDays, isValidDate, todayKst } from "./dates";
import { parseAmount, won, withComma } from "./format";

describe("계산", () => {
  it("요구사항 예시: 1억, 20%, 7천만 회수", () => {
    const total = expectedTotal(100_000_000, 20);
    expect(total).toBe(120_000_000);
    expect(total - 70_000_000).toBe(50_000_000);
    expect(recoveryRate(70_000_000, total)).toBe(58.33);
  });

  it("소수 수익률", () => {
    expect(expectedTotal(5_000_000, 12.5)).toBe(5_625_000);
  });

  it("시작일·만기일 기본값", () => {
    expect(defaultStartOn("2026-06-01")).toBe("2026-06-02");
    expect(defaultMaturityOn("2026-06-02", 100)).toBe("2026-09-09");
    expect(diffDays("2026-06-02", "2026-09-09")).toBe(99);
  });

  it("회수 횟수", () => {
    expect(installmentCount("daily", 100)).toBe(100);
    expect(installmentCount("every7", 100)).toBe(15);
    expect(installmentCount("every10", 100)).toBe(10);
    expect(installmentCount("monthly", 100)).toBe(3);
    expect(installmentCount("bullet", 100)).toBe(1);
  });
});

describe("날짜", () => {
  it("한국 시간 기준 오늘", () => {
    // UTC 9/28 16:00 = 한국 9/29 01:00
    expect(todayKst(new Date("2026-09-28T16:00:00Z"))).toBe("2026-09-29");
  });
  it("월말 처리", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("날짜 검증", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-02-28")).toBe(true);
  });
});

describe("금액 형식", () => {
  it("원화 표시", () => {
    expect(won(100_000_000)).toBe("100,000,000원");
    expect(withComma("1000000")).toBe("1,000,000");
  });
  it("입력값 해석", () => {
    expect(parseAmount("100,000,000")).toBe(100_000_000);
    expect(parseAmount("1억")).toBeNaN();
  });
});
