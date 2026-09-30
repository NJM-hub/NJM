import { describe, expect, it } from "vitest";
import { fareFor } from "./fare";

const rules = { base: 40000, gimpo: 37000, picketExtra: 5000 };

describe("fareFor", () => {
  it("기본 / 김포 / 피켓 / 예약에 적힌 금액", () => {
    expect(fareFor({ pickup_address: "인천국제공항 T1" }, rules)).toBe(40000);
    expect(fareFor({ dropoff_address: "김포국제공항 I" }, rules)).toBe(37000);
    expect(fareFor({ pickup_place: "金浦国际机场" }, rules)).toBe(37000);
    expect(fareFor({ pickup_address: "인천국제공항 T2", memo: "공항에서 픽업 1" }, rules)).toBe(45000);
    expect(fareFor({ pickup_address: "김포국제공항", memo: "举牌 피켓" }, rules)).toBe(42000);
    expect(fareFor({ pickup_address: "인천국제공항 T2", memo: "공항에서 픽업 0" }, rules)).toBe(40000);
    expect(fareFor({ fare: 50000, pickup_address: "김포국제공항" }, rules)).toBe(50000);
  });
});
