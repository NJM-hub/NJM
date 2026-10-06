import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { isKkdayScm } from "./scm";
import {
  findDispatchSheetHeader, findTime, isCancelledCell, isDispatchSheet, parseDispatchSheet, parseDriverCell, parseOwnCallText, sheetExtras, vehicleClassOf,
} from "./sheet";

// samples/dispatch-sheet-sample.csv: 구글 시트 배차표와 같은 컬럼, 가짜 데이터
const rows = Papa.parse<string[]>(readFileSync("samples/dispatch-sheet-sample.csv", "utf8")).data;
const h = findDispatchSheetHeader(rows);
const { bookings, ownCalls, notes, skipped } = parseDispatchSheet(rows, h);
const byNo = (no: string) => bookings.find((b) => b.bookingNo === no)!;

describe("구글 시트 배차표", () => {
  it("형식을 인식하고 표 아래 메모는 건너뛴다", () => {
    expect(h).toBe(0);
    expect(isDispatchSheet(rows[h])).toBe(true);
    expect(isKkdayScm(rows[h])).toBe(false);
    expect(bookings.map((b) => b.bookingNo)).toEqual([
      "26KK90000001", "26KK90000002", "26KK90000003", "26KK90000004", "26KK90000005", "26KK90000006", "26KK90000007",
      "26KK90000008", "TALIXO-2026-09-28-1705-9759",
    ]);
    expect(skipped).toBeGreaterThan(0);
  });

  it("샌딩: 숙소 → 공항, 차급·인원 변환", () => {
    const b = byNo("26KK90000003");
    expect(b).toMatchObject({
      serviceDate: "2026-09-28",
      pickupAt: "2026-09-28T04:00:00+09:00",
      tripType: "공항 샌딩",
      vehicleClass: "컴포트 7인승",
      pax: 4,
      pickupPlace: "Test Hotel Hongdae",
      pickupAddress: "3 Test-ro, Mapo-gu, Seoul, 韩国",
      dropoffAddress: "인천국제공항 T2",
      customerName: "TEST THREE",
      customerPhone: "+886-900000003",
      waitMin: 30,
      memo: null,
    });
    expect(b.dropoffLat).toBeCloseTo(37.4691, 3);
    expect(b.sheetDriver).toEqual({ kind: "vehicle", driverName: "金基峰", plateSuffix: "9763", label: "金基峰9763" });
  });

  it("픽업: 공항 → 숙소, 추가 서비스와 연락 앱을 메모로", () => {
    const b = byNo("26KK90000004");
    expect(b).toMatchObject({
      tripType: "공항 픽업",
      vehicleClass: "컴포트 10인승",
      pax: 3,
      flightNo: "XX123",
      pickupAddress: "인천국제공항 T1",
      dropoffPlace: "Test Hotel Gangnam",
      waitMin: 90,
      memo: "어린이 좌석 1, 피켓 1 / WHATSAPP +886900000004",
    });
    expect(b.pickupLat).toBeCloseTo(37.4492, 3);
  });

  it("외부 콜, 공백 섞인 기사명, 다른 인원 표기, 빈 기사", () => {
    expect(byNo("26KK90000001").sheetDriver).toEqual({ kind: "external", fare: 55000, label: "55000" });
    expect(byNo("26KK90000005")).toMatchObject({ memo: "會中文的司機", sheetDriver: { driverName: "Henry", plateSuffix: "9759" } });
    expect(byNo("26KK90000006")).toMatchObject({ pax: 3, pickupAt: "2026-09-28T16:00:00+09:00", sheetDriver: { driverName: "金龙喆", plateSuffix: "9778" } });
    const b7 = byNo("26KK90000007");
    expect(b7.sheetDriver).toBeNull();
    expect(b7.pickupAddress).toBe("김포국제공항");
    expect(b7.warnings).toContain("기사가 비어 있어 미배정으로 둡니다");
  });

  it("칸 변환", () => {
    expect(parseDriverCell("60,000")).toMatchObject({ kind: "external", fare: 60000 });
    expect(parseDriverCell("JACKY")).toEqual({ kind: "vehicle", driverName: "JACKY", plateSuffix: null, label: "JACKY" });
    expect(parseDriverCell("  ")).toBeNull();
    expect(parseDriverCell("投诉지각")).toBeNull();
    expect(parseDriverCell("9772 Henry")).toMatchObject({ kind: "vehicle", driverName: "Henry", plateSuffix: "9772" });
    expect(parseDriverCell("金龙喆 9778")).toMatchObject({ kind: "vehicle", driverName: "金龙喆", plateSuffix: "9778" });
  });

  it("취소 표시: 퍼센트 서식 숫자(1=100%, 0.5=50%), 비율 문구", () => {
    for (const c of [1, 0.5, "1", "0.5", "100%", "50%", "USD 20.38 (50%)", "100%取消", "50%취소"]) expect(isCancelledCell(c)).toBe(true);
    for (const c of [55000, "55000", "60,000", "金基峰9763", "9772 Henry", null, ""]) expect(isCancelledCell(c)).toBe(false);
    expect(vehicleClassOf("经济型5座")).toBe("이코노미 5인승");
    expect(sheetExtras("儿童座椅*0，举牌接机*0")).toBeNull();
  });
});

describe("손으로 고친 행, 다른 출처, 엑셀 셀", () => {
  it("날짜 없이 시간만 고친 행은 시트 날짜로", () => {
    expect(byNo("26KK90000008")).toMatchObject({ pickupAt: "2026-09-28T15:00:00+09:00", tripType: "공항 샌딩", pax: 2 });
  });

  it("TALIXO 처럼 칸 배치가 다른 행은 원문을 메모로", () => {
    expect(byNo("TALIXO-2026-09-28-1705-9759")).toMatchObject({
      pickupAt: "2026-09-28T17:05:00+09:00",
      tripType: "공항 픽업",
      pickupPlace: "인천국제공항",
      customerName: null,
      memo: "TALIXO / XX999 (Dubai) / TEST NINE / +44 0000000000 / Test Hotel Itaewon",
      sheetDriver: { plateSuffix: "9759" },
    });
  });

  it("기사 칸에 취소 표시가 있으면 예약에서 빼고 따로", () => {
    const { cancelled } = parseDispatchSheet(rows, h);
    expect(cancelled).toEqual([{ rowIndex: 12, bookingNo: "26KK90000010", text: "100%取消 12:00 공항 샌딩" }]);
    expect(bookings.some((b) => b.bookingNo === "26KK90000010")).toBe(false);
  });

  it("시간을 읽지 못한 예약 행은 확인용으로 따로", () => {
    expect(parseDispatchSheet(rows, h).unparsed.map((u) => u.rowIndex)).toEqual([11]);
  });

  it("엑셀 날짜 셀(초 오차)과 숫자 시각", () => {
    const x = [
      rows[0],
      ["26KK1", "A 1234", "送机", new Date("2026-09-01T15:59:59.999Z"), null, "经济型7座", "仁川国际机场", "T2"],
      ["26KK2", "A 1234", "接机", 8.3, null, "经济型7座", "ICN仁川國際機場T1"],
    ];
    const p = parseDispatchSheet(x, 0).bookings;
    expect(p.map((b) => b.pickupAt)).toEqual(["2026-09-01T16:00:00+09:00", "2026-09-01T08:30:00+09:00"]);
    expect(p[1]).toMatchObject({ pickupAddress: "인천국제공항 T1" });
  });
});

describe("기사 자체 콜 (표 아래 기사별 칸)", () => {
  const call = (driver: string, n = 0) => ownCalls.filter((c) => c.sheetDriver?.label === driver)[n];

  it("시간과 내용이 있는 칸만 콜, 휴무·입금·예약번호는 제외", () => {
    expect(ownCalls.map((c) => c.bookingNo)).toEqual([
      "OWN-2026-09-28-9763-1",
      "OWN-2026-09-28-9754-1",
      "OWN-2026-09-28-9754-2",
      "OWN-2026-09-28-9755-1",
      "OWN-2026-09-28-9661-1",
      "OWN-2026-09-28-9661-2",
    ]);
    expect(notes).toEqual([{ date: "2026-09-28", driver: "Henry 9759", text: "休息" }]);
    expect(ownCalls.every((c) => c.source === "driver_own" && c.serviceDate === "2026-09-28")).toBe(true);
  });

  it("샌딩: 장소 → 공항, 입금 확인", () => {
    expect(call("金基峰9763")).toMatchObject({
      pickupAt: "2026-09-28T09:00:00+09:00",
      tripType: "공항 샌딩",
      pickupPlace: "명동",
      dropoffPlace: "인천국제공항 T1",
      memo: "9:00 명동 S. T1 / 입금 확인",
      sheetDriver: { driverName: "金基峰", plateSuffix: "9763" },
    });
    expect(call("金基峰9763").pickupLat).toBeNull(); // 동네 이름은 배차 때 지도 검색
    expect(call("金基峰9763").dropoffLat).toBeCloseTo(37.4492, 3);
    expect(call("车秀荣9754", 1)).toMatchObject({ pickupAt: "2026-09-28T11:00:00+09:00", pickupPlace: "퇴계로", memo: "11:00. S 퇴계로 / 입금 확인" });
  });

  it("공항이 먼저 나오면 픽업, 전세는 금액, 점대점은 소요시간", () => {
    expect(call("佟晓川9661")).toMatchObject({ pickupAt: "2026-09-28T05:20:00+09:00", tripType: "공항 픽업", pickupPlace: "인천국제공항", dropoffPlace: "新林" });
    expect(call("全华峰 9755")).toMatchObject({ pickupAt: null, tripType: "시내 전세", fare: 80000, memo: "市内包车80000" });
    expect(call("佟晓川9661", 1)).toMatchObject({
      pickupAt: "2026-09-28T16:00:00+09:00", tripType: null, pickupPlace: "大林", dropoffPlace: "弘大", durationMin: 60,
    });
  });

  it("시각 인식", () => {
    expect(["1100 送机 江南", "15.30送机", "9点麻浦送仁川", "0600 送机", "送机17:00 东大门T1", "15:00。东大门 S。T2", "市内包车80000"].map(findTime))
      .toEqual(["11:00", "15:30", "09:00", "06:00", "17:00", "15:00", null]);
    expect(parseOwnCallText("21:30 J 江南")).toMatchObject({ tripType: "공항 픽업", place: "江南" });
    expect(parseOwnCallText("17:00 明洞 S 金浦")).toMatchObject({ tripType: "공항 샌딩", iata: "GMP", place: "明洞" });
    expect(parseOwnCallText("9/14 4:30 T2 S 东大门")).toMatchObject({ time: "04:30", terminal: "T2", place: "东大门" });
    expect(parseOwnCallText("12:00 送机 明洞 100000")).toMatchObject({ time: "12:00", tripType: "공항 샌딩", charterFare: 100000, place: "明洞" });
    expect(parseOwnCallText("市内包车 80,000")).toMatchObject({ charterFare: 80000 });
    expect(parseOwnCallText("1100 送机 江南").charterFare).toBeNull();
  });
});
