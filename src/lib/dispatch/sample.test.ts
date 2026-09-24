import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { expect, test } from "vitest";
import { findHeaderRow, guessMapping, parseRows } from "@/lib/kkday/parse";
import { dispatch } from "./algorithm";

// samples/kkday-sample.csv 를 파싱부터 배차까지 돌리는 회귀 테스트
const COORDS: Record<string, [number, number]> = {
  "인천국제공항 제1여객터미널": [37.4492, 126.4506],
  "인천국제공항 제2여객터미널": [37.4691, 126.4331],
  "명동 롯데호텔 서울": [37.5651, 126.9811],
  "홍대 L7호텔": [37.5575, 126.9245],
  "동대문 JW메리어트": [37.5705, 127.01],
  "강남 조선팰리스": [37.503, 127.0412],
};
const at = (a: string | null) => (a && COORDS[a] ? { lat: COORDS[a][0], lng: COORDS[a][1] } : null);

test("샘플 일정표: 4대 차량, 차량당 4콜", () => {
  const rows = Papa.parse<string[]>(readFileSync("samples/kkday-sample.csv", "utf8")).data;
  const h = findHeaderRow(rows);
  const parsed = parseRows(rows, h, guessMapping(rows[h]));
  expect(parsed).toHaveLength(18);

  const res = dispatch(
    parsed.map((p) => ({
      id: p.bookingNo!,
      pickupAt: p.pickupAt ? Date.parse(p.pickupAt) : null,
      durationMin: p.durationMin,
      pickup: at(p.pickupAddress),
      dropoff: at(p.dropoffAddress),
      pax: p.pax,
    })),
    [
      { id: "s1", seats: 4, base: at("명동 롯데호텔 서울") },
      { id: "s2", seats: 4, base: at("강남 조선팰리스") },
      { id: "v1", seats: 9, base: at("홍대 L7호텔") },
      { id: "v2", seats: 9, base: at("동대문 JW메리어트") },
    ],
  );

  expect(res.summary.assigned).toBe(15);
  expect(Object.fromEntries(res.unassigned.map((u) => [u.bookingId, u.reason]))).toEqual({
    KK2609017: "MISSING_TIME",
    KK2609016: "PAX_EXCEEDS_SEATS",
    KK2609004: "TIME_CONFLICT",
  });
  for (const r of res.routes) {
    expect(r.stops.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < r.stops.length; i++) {
      expect(r.stops[i].readyAt).toBeLessThanOrEqual(r.stops[i].pickupAt);
      expect(r.stops[i].pickupAt).toBeGreaterThanOrEqual(r.stops[i - 1].endAt);
    }
  }
});
