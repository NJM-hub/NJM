import type { SheetBooking } from "@/lib/kkday/sheet";
import { gradeRequired, parseVehicleClass } from "./vehicleClass";

export type PlanVehicle = { id: string; plate_number: string; driver_name: string | null };

export type NewVehicle = { key: string; plate_number: string; driver_name: string | null; seats: number; grade: string | null };

export type VehiclePlan = {
  /** 시트의 기사 칸 키 → 기존 차량 id (새로 만들 차량은 없음) */
  matched: Map<string, string>;
  /** 새로 등록할 차량 */
  create: NewVehicle[];
  /** 기존 차량에 기사 이름만 채워 넣을 것 */
  setDriverName: { id: string; driver_name: string }[];
};

/** 시트 기사 칸의 차량 키: 차량번호 뒤 4자리, 없으면 기사명 */
export function sheetVehicleKey(b: SheetBooking): string | null {
  const d = b.sheetDriver;
  if (d?.kind !== "vehicle") return null;
  return d.plateSuffix ?? d.driverName;
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * 시트의 기사/차량을 등록된 차량과 맞춘다.
 * 차량번호 뒤 4자리가 같은 차량(여러 대면 기사 이름이 같은 차량)을 쓰고, 없으면 새로 등록한다.
 * "9754 차수영"과 "9754김기봉"처럼 기사가 달라도 번호가 같으면 같은 차량이다.
 * 새 차량의 좌석 수·등급은 그 차량에 배정된 예약 중 가장 큰 차급으로 정한다.
 */
export function planSheetVehicles(bookings: SheetBooking[], vehicles: PlanVehicle[]): VehiclePlan {
  const groups = new Map<string, SheetBooking[]>();
  for (const b of bookings) {
    const k = sheetVehicleKey(b);
    if (k) groups.set(k, [...(groups.get(k) ?? []), b]);
  }

  const plan: VehiclePlan = { matched: new Map(), create: [], setDriverName: [] };
  for (const [key, list] of groups) {
    const d = list[0].sheetDriver as Extract<SheetBooking["sheetDriver"], { kind: "vehicle" }>;
    // 같은 차량을 다른 기사가 잠깐 빌려 운행할 수 있으므로 차량 기준으로 묶고, 기사 이름은 가장 많이 운행한 사람
    const counts = new Map<string, number>();
    for (const b of list) {
      const n = (b.sheetDriver as typeof d).driverName;
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const name = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? d.driverName;
    const candidates = d.plateSuffix
      ? vehicles.filter((v) => digits(v.plate_number).endsWith(d.plateSuffix!))
      : vehicles.filter((v) => v.driver_name === name || v.plate_number === name);
    const found = candidates.find((v) => name && v.driver_name === name) ?? candidates[0];
    if (found) {
      plan.matched.set(key, found.id);
      if (!found.driver_name && name) plan.setDriverName.push({ id: found.id, driver_name: name });
      continue;
    }
    let seats = 4;
    let grade: string | null = null;
    for (const b of list) {
      const cls = parseVehicleClass(b.vehicleClass);
      seats = Math.max(seats, cls.seats ?? 0, b.pax);
      grade ??= gradeRequired(cls.grade);
    }
    plan.create.push({ key, plate_number: key, driver_name: name, seats, grade });
  }
  return plan;
}
