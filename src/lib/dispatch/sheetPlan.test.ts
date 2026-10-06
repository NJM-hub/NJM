import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { expect, it } from "vitest";
import { findDispatchSheetHeader, parseDispatchSheet } from "@/lib/kkday/sheet";
import { planSheetVehicles } from "./sheetPlan";

const rows = Papa.parse<string[]>(readFileSync("samples/dispatch-sheet-sample.csv", "utf8")).data;
const { bookings } = parseDispatchSheet(rows, findDispatchSheetHeader(rows));

it("시트 기사/차량을 등록 차량과 맞추고, 없으면 새로 등록", () => {
  const plan = planSheetVehicles(bookings, [
    { id: "v1", plate_number: "12가9763", driver_name: null },
    { id: "v2", plate_number: "34나9759", driver_name: "다른기사" },
    { id: "v3", plate_number: "56다9759", driver_name: "Henry" },
  ]);
  expect([...plan.matched]).toEqual([["9763", "v1"], ["9759", "v3"]]);
  expect(plan.setDriverName).toEqual([{ id: "v1", driver_name: "金基峰" }]);
  // 외부 콜(금액)과 빈 칸은 차량이 아니다
  expect(plan.create).toEqual([{ key: "9778", plate_number: "9778", driver_name: "金龙喆", seats: 7, grade: null }]);
});

it("새 차량은 배정된 예약 중 가장 큰 차급", () => {
  const plan = planSheetVehicles(bookings, []);
  expect(plan.create.find((c) => c.key === "9763")).toMatchObject({ seats: 10, grade: "컴포트", driver_name: "金基峰" });
  expect(plan.create).toHaveLength(3);
});

it("같은 차량을 다른 기사가 운행해도 차량번호로 묶는다 (9754 차수영 / 9754김기봉)", () => {
  const mk = (label: string) =>
    ({ ...bookings[0], sheetDriver: { kind: "vehicle", driverName: label.replace(/\d{4}/, "").trim(), plateSuffix: "9754", label } }) as (typeof bookings)[number];
  const list = [mk("9754 차수영"), mk("9754김기봉"), mk("차수영9754")];
  // 등록된 차량이 있으면 그 차량 하나로, 담당 기사 이름은 바꾸지 않는다
  const a = planSheetVehicles(list, [{ id: "v9754", plate_number: "161하9754", driver_name: "차수영" }]);
  expect([...a.matched]).toEqual([["9754", "v9754"]]);
  expect(a.create).toEqual([]);
  expect(a.setDriverName).toEqual([]);
  // 없으면 한 대만 만들고, 이름은 가장 많이 운행한 기사
  const b = planSheetVehicles(list, []);
  expect(b.create).toHaveLength(1);
  expect(b.create[0]).toMatchObject({ plate_number: "9754", driver_name: "차수영" });
});
