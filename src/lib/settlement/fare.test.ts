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

  it("어린이 좌석은 1개당, 피켓과 따로 더한다", () => {
    const r = { base: 40000, gimpo: 40000, picketExtra: 5000, childSeatExtra: 5000 };
    expect(fareFor({ memo: "어린이 좌석 1, 피켓 1" }, r)).toBe(50000);
    expect(fareFor({ memo: "어린이 좌석 1 / KAKAO abc" }, r)).toBe(45000);
    expect(fareFor({ memo: "어린이 좌석 2 / 카시트가 필요한 유아 2명" }, r)).toBe(50000);
    expect(fareFor({ memo: "피켓 1 / WHATSAPP +886" }, r)).toBe(45000);
    expect(fareFor({ memo: "自備兒童安全座椅 上車時間" }, r)).toBe(40000);
    expect(fareFor({ memo: "儿童座椅*1，举牌接机*1" }, r)).toBe(50000);
  });
});
