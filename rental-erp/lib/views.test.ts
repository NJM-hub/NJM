import { describe, expect, it } from "vitest";
import { compareUnitNo } from "@/lib/views";

describe("호실 순서", () => {
  it("지하(B101) 먼저, 그다음 숫자 크기순", () => {
    const list = ["302호", "1001호", "B101", "101호", "102호", "B102호", "지하1층", "2층", "1층"];
    expect([...list].sort(compareUnitNo)).toEqual(["지하1층", "B101", "B102호", "1층", "2층", "101호", "102호", "302호", "1001호"]);
  });
  it("소문자 b 도 지하로", () => {
    expect(["101호", "b101"].sort(compareUnitNo)).toEqual(["b101", "101호"]);
  });
});
