import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT, shiftCheck, type Stop } from "./algorithm";

const at = (hhmm: string) => new Date(`2026-10-09T${hhmm}:00+09:00`).getTime();
const stop = (pick: string, end: string, deadheadMin = 30): Stop => ({ bookingId: pick, seq: 0, deadheadKm: null, deadheadMin, readyAt: at(pick), pickupAt: at(pick), endAt: at(end) });

describe("기사 피로 규칙", () => {
  it("새벽 시작 + 밤늦은 콜인데 오후에 쉬는 시간이 없으면 불가", () => {
    // 9754 예: 05:00 시작, 22:20 마지막 (오후에 계속 운행)
    const s = [stop("05:00", "07:30"), stop("08:30", "10:30"), stop("11:00", "13:30"), stop("14:15", "16:30"), stop("16:50", "19:00"), stop("22:20", "23:59")];
    expect(shiftCheck(s, DEFAULT_SHIFT)).toEqual({ longDay: true, ok: false });
  });
  it("오후에 3시간 이상 비면 허용 (가급적 피하도록 longDay 표시)", () => {
    const s = [stop("05:00", "07:30"), stop("09:00", "11:00"), stop("16:00", "18:00"), stop("21:00", "23:00")];
    expect(shiftCheck(s, DEFAULT_SHIFT)).toEqual({ longDay: true, ok: true });
  });
  it("늦게 시작하거나 일찍 끝나면 해당 없음", () => {
    expect(shiftCheck([stop("10:30", "12:30"), stop("22:00", "23:30")], DEFAULT_SHIFT)).toEqual({ longDay: false, ok: true });
    expect(shiftCheck([stop("05:00", "07:00"), stop("17:00", "19:00")], DEFAULT_SHIFT)).toEqual({ longDay: false, ok: true });
  });
});

describe("전날 휴식·정체 시간대", async () => {
  const { simulateRoute, DEFAULT_OPTIONS, DEFAULT_RUSH } = await import("./algorithm");
  const v = { id: "v", seats: 9, base: null };
  const bk = (id: string, hhmm: string) => ({ id, pickupAt: at(hhmm), durationMin: 60, pickup: { lat: 37.45, lng: 126.45 }, dropoff: { lat: 37.56, lng: 126.98 }, pax: 2 });
  it("휴식 시각 전 첫 콜은 받지 않음", () => {
    expect(simulateRoute({ ...v, earliestStart: at("09:30") }, [bk("a", "06:00")], DEFAULT_OPTIONS)).toBeNull();
    expect(simulateRoute({ ...v, earliestStart: at("09:30") }, [bk("a", "10:00")], DEFAULT_OPTIONS)).not.toBeNull();
  });
  it("17~19시엔 이동을 넉넉히 잡아 빠듯한 연속 콜은 안 됨", () => {
    // 16:00 콜(60분) 끝 17:00 → 시내에서 공항까지 이동 후 19:30 픽업
    const route = [bk("a", "16:00"), { ...bk("b", "19:30"), pickup: { lat: 37.45, lng: 126.45 } }];
    const normal = simulateRoute(v, route, DEFAULT_OPTIONS);
    const rush = simulateRoute(v, route, { ...DEFAULT_OPTIONS, rush: DEFAULT_RUSH });
    expect(normal).not.toBeNull();
    expect(rush === null || rush[1].readyAt > normal![1].readyAt).toBe(true);
  });
});
