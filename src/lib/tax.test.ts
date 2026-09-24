import { describe, expect, it } from "vitest";
import { computeWithholding, csvCell, filingDeadlines } from "./tax";

describe("computeWithholding", () => {
  it("3.3% 원천징수, 10원 미만 절사", () => {
    expect(computeWithholding(1_234_567)).toEqual({
      gross: 1_234_567,
      incomeTax: 37_030,
      localTax: 3_700,
      totalTax: 40_730,
      net: 1_193_837,
    });
  });
  it("소득세 1,000원 미만은 소액부징수", () => {
    expect(computeWithholding(33_000).totalTax).toBe(0);
    expect(computeWithholding(34_000).incomeTax).toBe(1_020);
  });
});

describe("filingDeadlines", () => {
  it("다음달 10일 / 다음달 말일", () => {
    expect(filingDeadlines("2026-09")).toEqual({ withholdingReturn: "2026-10-10", simplifiedStatement: "2026-10-31" });
    expect(filingDeadlines("2026-12")).toEqual({ withholdingReturn: "2027-01-10", simplifiedStatement: "2027-01-31" });
  });
});

describe("csvCell", () => {
  it("수식 주입 방지 및 따옴표 처리", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-1500")).toBe("-1500");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
