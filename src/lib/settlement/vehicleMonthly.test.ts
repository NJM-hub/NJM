import { expect, it } from "vitest";
import { DEFAULT_WITHHOLDING } from "@/lib/tax";
import { computePayout, inOutLabel, summarizeVehicleMonth, type VehicleMonthRow } from "./vehicleMonthly";

let n = 0;
const row = (date: string, plate: string, tripType: string | null, extra: Partial<VehicleMonthRow> = {}): VehicleMonthRow => ({
  id: `a${n++}`, serviceDate: date, vehicleId: plate, plate, driverName: "车秀荣", tripType, source: null, amount: 40000,
  pickupAt: `${date}T12:00:00+09:00`, ...extra,
});

it("차량별 날짜별 픽업/샌딩 건수와 금액, 외부오더는 차감", () => {
  const [a, b] = summarizeVehicleMonth([
    row("2026-09-02", "9754", "공항 픽업", { amount: 45000 }),
    row("2026-09-01", "9754", "공항 샌딩"),
    row("2026-09-01", "9754", "공항 픽업", { pickupAt: "2026-09-01T09:00:00+09:00" }),
    row("2026-09-01", "9754", "공항 픽업"),
    row("2026-09-01", "9754", "공항 샌딩", { source: "driver_own", amount: -15000 }),
    row("2026-09-02", "9754", "시내 전세", { amount: 80000 }),
    row("2026-09-01", "12가9661", "공항 샌딩", { vehicleId: "v9661", driverName: "佟晓川" }),
  ]);
  expect(a).toMatchObject({ plate: "12가9661", driverName: "佟晓川", total: { sending: 1, calls: 1, workDays: 1, amount: 40000 } });
  expect(b.plate).toBe("9754");
  expect(b.days).toEqual([
    { date: "2026-09-01", pickup: 2, sending: 1, other: 0, own: 1, amount: 105000 },
    { date: "2026-09-02", pickup: 1, sending: 0, other: 1, own: 0, amount: 125000 },
  ]);
  expect(b.total).toEqual({ pickup: 3, sending: 1, other: 1, own: 1, amount: 230000, calls: 5, workDays: 2 });
  // 건별 내역: 날짜·시간순, 외부오더는 맨 아래
  expect(b.rows.map(inOutLabel)).toEqual(["픽업", "샌딩", "픽업", "픽업", "시내 전세", "외부오더"]);
});

it("8월 차수영 정산표와 같은 계산: 금액 합계 − 비용 = 차액, 3.3% 떼고 지급", () => {
  const p = computePayout(6_373_000, { fuel: 2_232_693, fines: 96_000, tolls: 960_500, engine_oil: 0, other: 0 }, DEFAULT_WITHHOLDING);
  expect(p).toEqual({
    amount: 6_373_000, expenses: 3_289_193, diff: 3_083_807,
    incomeTax: 92_510, localTax: 9_250, tax: 101_760, pay: 2_982_047,
  });
  expect(computePayout(100_000, null, DEFAULT_WITHHOLDING)).toMatchObject({ expenses: 0, diff: 100_000, tax: 3_300, pay: 96_700 });
});
