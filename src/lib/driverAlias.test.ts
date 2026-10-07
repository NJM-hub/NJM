import { describe, expect, it } from "vitest";
import { canonicalDriver, parseDriverAliases } from "./driverAlias";

describe("기사 이름 합치기", () => {
  const a = parseDriverAliases("김성원 = JACKY\n여호란, 吕浩兰 → 여호연\n잘못된 줄");
  it("다른 이름은 정산에 쓸 이름으로", () => {
    expect(canonicalDriver("김성원", a)).toBe("JACKY");
    expect(canonicalDriver("Jacky", a)).toBe("JACKY");
    expect(canonicalDriver("여호란", a)).toBe("여호연");
    expect(canonicalDriver("吕浩兰", a)).toBe("여호연");
    expect(canonicalDriver("임걸", a)).toBe("임걸");
    expect(canonicalDriver(null, a)).toBeNull();
  });
});
