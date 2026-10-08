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
