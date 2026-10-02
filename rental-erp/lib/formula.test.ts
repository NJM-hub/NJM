import { describe, expect, it } from "vitest";
import { checkFormula, evaluate } from "@/lib/formula";

describe("계산식", () => {
  it("한글 변수 사칙연산", () => {
    expect(evaluate("월세수입 + 기타수입 - 운영비 - 대출이자", { 월세수입: 100, 기타수입: 10, 운영비: 20, 대출이자: 30 })).toBe(60);
    expect(evaluate("(a + b) * 2 / 4", { a: 1, b: 3 })).toBe(2);
    expect(evaluate("-a + 1,000", { a: 1 })).toBe(999);
    expect(evaluate("max(a, 0) × 12", { a: -5 })).toBe(0);
  });
  it("0 으로 나누면 0", () => {
    expect(evaluate("a / b", { a: 1, b: 0 })).toBe(0);
  });
  it("잘못된 식은 오류 메시지", () => {
    expect(checkFormula("월세수입 +", ["월세수입"])).toBeTruthy();
    expect(checkFormula("없는항목 * 2", ["월세수입"])).toContain("알 수 없는 항목");
    expect(checkFormula("월세수입; drop", ["월세수입"])).toContain("사용할 수 없는 문자");
    expect(checkFormula("월세수입 * 12", ["월세수입"])).toBeNull();
  });
});
