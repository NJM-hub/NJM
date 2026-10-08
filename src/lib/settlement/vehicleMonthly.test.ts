import { describe, expect, it } from "vitest";
import { DEFAULT_WITHHOLDING } from "@/lib/tax";
import { assignSettleOperators, computePayout, inOutLabel, OWN_CALL, summarizeOperators, summarizeVehicleMonth, type VehicleMonthRow } from "./vehicleMonthly";

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
    { date: "2026-09-01", pickup: 2, sending: 1, other: 0, own: 1, amount: 120000, ownAmount: -15000 },
    { date: "2026-09-02", pickup: 1, sending: 0, other: 1, own: 0, amount: 125000, ownAmount: 0 },
  ]);
  expect(b.total).toEqual({ pickup: 3, sending: 1, other: 1, own: 1, amount: 245000, ownAmount: -15000, calls: 5, workDays: 2 });
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

describe("summarizeOperators", () => {
  it("같은 차량번호를 여러 기사가 운행하면 기사별로 나눈다", () => {
    const base = { serviceDate: "2026-10-01", vehicleId: "v", plate: "161하9754", driverName: "车秀荣", source: null };
    const rows = [
      { ...base, id: "1", tripType: "공항 픽업", amount: 40000, operator: "车秀荣" },
      { ...base, id: "2", tripType: "공항 샌딩", amount: 40000, operator: "김기봉" },
      { ...base, id: "3", tripType: "공항 샌딩", amount: 45000, operator: "车秀荣" },
      { ...base, id: "4", tripType: null, amount: -15000, operator: "车秀荣", source: OWN_CALL },
      { ...base, id: "5", tripType: null, amount: 30000, manualSource: "TALIXO" },
    ];
    expect(summarizeOperators(rows, "车秀荣")).toEqual([
      { name: "车秀荣", calls: 2, pickup: 1, sending: 1, own: 1, amount: 115000, ownAmount: -15000 },
      { name: "김기봉", calls: 1, pickup: 0, sending: 1, own: 0, amount: 40000, ownAmount: 0 },
    ]);
  });
});

describe("같은 차량 여러 기사: 기사별 따로 정산", () => {
  const base = { serviceDate: "2026-09-01", vehicleId: "v9660", plate: "9660", source: null, tripType: "공항 픽업", amount: 40000 };
  it("담당 기사와 다른 운행 기사는 별도 정산 단위", () => {
    const rows: VehicleMonthRow[] = [
      { ...base, id: "1", driverName: "김성원", operator: "김성원" },
      { ...base, id: "2", driverName: "김성원", operator: "JACKY" },
      { ...base, id: "3", driverName: "김성원", operator: null },
      { ...base, id: "4", driverName: "김성원", operator: "JACKY", source: OWN_CALL, amount: -15000 },
    ];
    assignSettleOperators(rows);
    const list = summarizeVehicleMonth(rows);
    expect(list.map((v) => [v.key, v.driverName, v.total.calls, v.total.own, v.total.amount])).toEqual([
      ["v9660", "김성원", 2, 0, 80000],
      ["v9660~JACKY", "JACKY", 1, 1, 40000],
    ]);
  });
  it("차량에 기사 이름이 없으면 가장 많이 운행한 기사가 기본", () => {
    const rows: VehicleMonthRow[] = [
      { ...base, id: "1", driverName: null, operator: "임걸" },
      { ...base, id: "2", driverName: null, operator: "임걸" },
      { ...base, id: "3", driverName: null, operator: "김혜영" },
    ];
    assignSettleOperators(rows);
    expect(summarizeVehicleMonth(rows).map((v) => [v.key, v.driverName, v.total.calls])).toEqual([
      ["v9660", "임걸", 2],
      ["v9660~김혜영", "김혜영", 1],
    ]);
  });
});

describe("KKday 차액", () => {
  it("부가세 뺀 정산 금액 − 기사 지급액, 외부오더·내역서 없음은 제외", async () => {
    const { kkdayDiffOf, kkdayTotals } = await import("./vehicleMonthly");
    expect(kkdayDiffOf({ kkdayAmount: 60000, amount: 45000, source: null })).toEqual({ net: 54545, diff: 9545 });
    expect(kkdayDiffOf({ kkdayAmount: 56800, amount: 55000, source: null })).toEqual({ net: 51636, diff: -3364 });
    expect(kkdayDiffOf({ kkdayAmount: null, amount: 40000, source: null })).toBeNull();
    expect(kkdayDiffOf({ kkdayAmount: 60000, amount: -15000, source: OWN_CALL })).toBeNull();
    const base = { serviceDate: "2026-09-01", vehicleId: "v", plate: "9754", driverName: "차수영", tripType: null, source: null };
    expect(kkdayTotals([
      { ...base, id: "1", amount: 45000, kkdayAmount: 60000 },
      { ...base, id: "2", amount: 40000, kkdayAmount: null },
    ])).toEqual({ count: 1, amount: 60000, net: 54545, paid: 45000, diff: 9545 });
  });
});
