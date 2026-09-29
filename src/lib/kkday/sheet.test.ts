import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { isKkdayScm } from "./scm";
import { findDispatchSheetHeader, isDispatchSheet, parseDispatchSheet, parseDriverCell, sheetExtras, vehicleClassOf } from "./sheet";

// samples/dispatch-sheet-sample.csv: 구글 시트 배차표와 같은 컬럼, 가짜 데이터
const rows = Papa.parse<string[]>(readFileSync("samples/dispatch-sheet-sample.csv", "utf8")).data;
const h = findDispatchSheetHeader(rows);
const { bookings, skipped } = parseDispatchSheet(rows, h);
const byNo = (no: string) => bookings.find((b) => b.bookingNo === no)!;

describe("구글 시트 배차표", () => {
  it("형식을 인식하고 표 아래 메모는 건너뛴다", () => {
    expect(h).toBe(0);
    expect(isDispatchSheet(rows[h])).toBe(true);
    expect(isKkdayScm(rows[h])).toBe(false);
    expect(bookings.map((b) => b.bookingNo)).toEqual([
      "TESTKK001", "TESTKK002", "TESTKK003", "TESTKK004", "TESTKK005", "TESTKK006", "TESTKK007",
    ]);
    expect(skipped).toBe(2);
  });

  it("샌딩: 숙소 → 공항, 차급·인원 변환", () => {
    const b = byNo("TESTKK003");
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
    const b = byNo("TESTKK004");
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
    expect(byNo("TESTKK001").sheetDriver).toEqual({ kind: "external", fare: 55000, label: "55000" });
    expect(byNo("TESTKK005")).toMatchObject({ memo: "會中文的司機", sheetDriver: { driverName: "Henry", plateSuffix: "9759" } });
    expect(byNo("TESTKK006")).toMatchObject({ pax: 3, pickupAt: "2026-09-28T16:00:00+09:00", sheetDriver: { driverName: "金龙喆", plateSuffix: "9778" } });
    const b7 = byNo("TESTKK007");
    expect(b7.sheetDriver).toBeNull();
    expect(b7.pickupAddress).toBe("김포국제공항");
    expect(b7.warnings).toContain("기사가 비어 있어 미배정으로 둡니다");
  });

  it("칸 변환", () => {
    expect(parseDriverCell("60,000")).toMatchObject({ kind: "external", fare: 60000 });
    expect(parseDriverCell("JACKY")).toEqual({ kind: "vehicle", driverName: "JACKY", plateSuffix: null, label: "JACKY" });
    expect(parseDriverCell("  ")).toBeNull();
    expect(vehicleClassOf("经济型5座")).toBe("이코노미 5인승");
    expect(sheetExtras("儿童座椅*0，举牌接机*0")).toBeNull();
  });
});
