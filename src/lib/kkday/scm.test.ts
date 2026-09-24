import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { canServe } from "@/lib/dispatch/algorithm";
import { gradeRequired, parseVehicleClass } from "@/lib/dispatch/vehicleClass";
import { findHeaderRow } from "./parse";
import { extraServices, isKkdayScm, kkTime, parseKkdayScm } from "./scm";

// samples/kkday-scm-sample.csv: 실제 KKday 공급사 주문 내보내기와 같은 컬럼, 가짜 데이터
const rows = Papa.parse<string[]>(readFileSync("samples/kkday-scm-sample.csv", "utf8")).data;

describe("KKday 공급사 주문 내보내기", () => {
  it("형식을 인식하고 취소 건을 제외한다", () => {
    const h = findHeaderRow(rows);
    expect(isKkdayScm(rows[h])).toBe(true);
    const { bookings, cancelled } = parseKkdayScm(rows, h);
    expect(cancelled).toBe(1);
    expect(bookings.map((b) => b.bookingNo)).toEqual(["TEST001", "TEST002", "TEST003", "TEST004", "TEST005"]);
  });

  it("공항 픽업: 공항 → 숙소, 이용 시간 도착, 최종 픽업까지 대기", () => {
    const [b] = parseKkdayScm(rows, 0).bookings;
    expect(b).toMatchObject({
      pickupAt: "2026-09-23T15:35:00+09:00",
      serviceDate: "2026-09-23",
      waitMin: 90,
      pax: 4,
      tripType: "공항 픽업",
      vehicleClass: "이코노미 7인승",
      pickupAddress: "인천국제공항 T1",
      dropoffPlace: "테스트호텔 명동",
      dropoffAddress: "서울특별시 중구 명동길 1",
      flightNo: "XX101",
      memo: null,
    });
    expect(b.pickupLat).toBeCloseTo(37.4492, 3);
    expect(b.dropoffLat).toBeNull();
  });

  it("공항 샌딩: 숙소 → 공항, 김포 좌표", () => {
    const b = parseKkdayScm(rows, 0).bookings.find((x) => x.bookingNo === "TEST004")!;
    expect(b).toMatchObject({ waitMin: 30, pickupPlace: "테스트호텔 강남", dropoffAddress: "김포국제공항", pax: 5 });
    expect(b.dropoffLat).toBeCloseTo(37.56, 1);
  });

  it("자정 넘는 픽업은 이용 시간 날짜 기준", () => {
    const b = parseKkdayScm(rows, 0).bookings.find((x) => x.bookingNo === "TEST005")!;
    expect(b.serviceDate).toBe("2026-09-23");
  });

  it("추가 서비스", () => {
    expect(extraServices("어린이용 좌석*1，공항에서 픽업*0")).toBe("어린이용 좌석 1");
    expect(extraServices("어린이용 좌석*0，공항에서 픽업*0")).toBeNull();
    expect(kkTime("2026-09-24 01:00:00（GMT）+09:00")).toBe("2026-09-24T01:00:00+09:00");
  });
});

describe("차급 매칭", () => {
  const cls = (s: string) => {
    const c = parseVehicleClass(s);
    return { id: "b", pickupAt: 0, durationMin: 60, pickup: null, dropoff: null, pax: 2, minSeats: c.seats, grade: gradeRequired(c.grade) };
  };
  it("인승과 등급", () => {
    expect(parseVehicleClass("이코노미 9인승")).toEqual({ grade: "이코노미", seats: 9 });
    expect(parseVehicleClass("10인승")).toEqual({ grade: null, seats: 10 });
    const eco5 = { id: "v", seats: 5, base: null, grade: null };
    const eco7 = { id: "v", seats: 7, base: null, grade: null };
    const com7 = { id: "v", seats: 7, base: null, grade: "컴포트" };
    expect(canServe(eco5, cls("이코노미 7인승"))).toBe(false);
    expect(canServe(eco7, cls("이코노미 7인승"))).toBe(true);
    expect(canServe(com7, cls("이코노미 7인승"))).toBe(true);
    expect(canServe(eco7, cls("컴포트 7인승"))).toBe(false);
    expect(canServe(com7, cls("컴포트7인승"))).toBe(true);
  });
});
