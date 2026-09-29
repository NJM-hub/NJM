import { describe, expect, it } from "vitest";
import { defaultStartOn, expectedTotal, maturityOn, recoveryRate, remaining } from "@/lib/calc";
import { comma, parseMoney, won } from "@/lib/format";
import { diffDays, isDate } from "@/lib/dates";

describe("회수 계산", () => {
  it("요구사항 예시: 1억, 20%, 7천만 회수", () => {
    const total = expectedTotal(100_000_000, 20);
    expect(total).toBe(120_000_000);
    expect(remaining(total, 70_000_000)).toBe(50_000_000);
    expect(recoveryRate(70_000_000, total)).toBe(58.33);
  });

  it("소수 수익률도 원 단위로 반올림", () => {
    expect(expectedTotal(33_333_333, 12.5)).toBe(37_500_000);
  });

  it("만기일 = 시작일 + 기간 - 1", () => {
    expect(defaultStartOn("2026-09-29")).toBe("2026-09-30");
    expect(maturityOn("2026-09-30", 100)).toBe("2027-01-07");
    expect(diffDays("2026-09-30", "2027-01-07") + 1).toBe(100);
  });
});

describe("표시 형식", () => {
  it("원화 천 단위 쉼표", () => {
    expect(won(100_000_000)).toBe("100,000,000원");
    expect(comma("1000000")).toBe("1,000,000");
    expect(parseMoney("₩100,000,000원")).toBe(100_000_000);
    expect(parseMoney("abc")).toBeNaN();
  });

  it("날짜 검사", () => {
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-02-28")).toBe(true);
  });
});
