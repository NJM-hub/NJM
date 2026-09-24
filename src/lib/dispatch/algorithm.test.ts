import { describe, expect, it } from "vitest";
import { dispatch, type DispatchBooking, type DispatchVehicle } from "./algorithm";

const H = 3_600_000;
const day = Date.UTC(2026, 8, 24, 0, 0); // 09:00 KST
const seoul = { lat: 37.5665, lng: 126.978 };
const incheonAirport = { lat: 37.4602, lng: 126.4407 };
const busan = { lat: 35.1796, lng: 129.0756 };

function booking(id: string, hour: number, extra: Partial<DispatchBooking> = {}): DispatchBooking {
  return { id, pickupAt: day + hour * H, durationMin: 60, pickup: seoul, dropoff: seoul, pax: 2, ...extra };
}
const car = (id: string, seats = 4): DispatchVehicle => ({ id, seats, base: seoul });

describe("dispatch", () => {
  it("차량당 최대 4콜까지만 배정한다", () => {
    const bookings = Array.from({ length: 10 }, (_, i) => booking(`b${i}`, i * 2));
    const res = dispatch(bookings, [car("v1"), car("v2")]);
    for (const r of res.routes) expect(r.stops.length).toBeLessThanOrEqual(4);
    expect(res.summary.assigned).toBe(8);
    expect(res.summary.unassigned).toBe(2);
    expect(res.unassigned.every((u) => u.reason === "ALL_VEHICLES_FULL")).toBe(true);
    expect(res.summary.extraVehiclesNeeded).toBe(1);
  });

  it("같은 시간대 예약은 서로 다른 차량에 배정한다", () => {
    const res = dispatch([booking("a", 1), booking("b", 1)], [car("v1"), car("v2")]);
    const used = res.routes.filter((r) => r.stops.length > 0);
    expect(used).toHaveLength(2);
  });

  it("이동 시간이 부족하면 배차 불가(TIME_CONFLICT)로 남긴다", () => {
    const res = dispatch(
      [
        booking("a", 1, { dropoff: busan }),
        booking("b", 3, { pickup: seoul }),
      ],
      [car("v1")],
    );
    expect(res.summary.assigned).toBe(1);
    expect(res.unassigned[0]).toEqual({ bookingId: "b", reason: "TIME_CONFLICT" });
  });

  it("인원이 좌석보다 많으면 큰 차량에 배정하고, 없으면 불가 처리", () => {
    const res = dispatch([booking("big", 1, { pax: 9 }), booking("huge", 2, { pax: 20 })], [car("s", 4), car("van", 11)]);
    expect(res.routes.find((r) => r.vehicleId === "van")!.stops[0].bookingId).toBe("big");
    expect(res.unassigned).toEqual([{ bookingId: "huge", reason: "PAX_EXCEEDS_SEATS" }]);
  });

  it("픽업 시간이 없으면 MISSING_TIME", () => {
    const res = dispatch([booking("x", 1, { pickupAt: null })], [car("v1")]);
    expect(res.unassigned[0].reason).toBe("MISSING_TIME");
  });

  it("가까운 동선의 차량을 선택한다", () => {
    const airportCar: DispatchVehicle = { id: "air", seats: 4, base: incheonAirport };
    const res = dispatch([booking("a", 2, { pickup: incheonAirport })], [car("seoul"), airportCar]);
    expect(res.routes.find((r) => r.vehicleId === "air")!.stops).toHaveLength(1);
  });

  it("보정 단계에서 다른 차로 옮겨 빈자리를 만든다", () => {
    // v_big(11인승)이 먼저 소형 예약들로 꽉 차면 대형 예약이 불가해지는 상황
    const small = [0, 2, 4, 6].map((h) => booking(`s${h}`, h, { pax: 2 }));
    const big = booking("big", 8, { pax: 8 });
    const res = dispatch([...small, big], [car("v_big", 11), car("v_small", 4)], { maxCallsPerVehicle: 4 });
    expect(res.summary.unassigned).toBe(0);
  });
});
