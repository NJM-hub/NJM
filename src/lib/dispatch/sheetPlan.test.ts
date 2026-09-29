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
