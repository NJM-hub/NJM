import { describe, expect, it } from "vitest";
import { durationFromText, findHeaderRow, guessMapping, parseDate, parseRows, parseTime } from "./parse";

describe("guessMapping", () => {
  it("KKday 영문 헤더를 인식한다", () => {
    const m = guessMapping(["Order No.", "Product Name", "Date", "Time", "Traveler Name", "Contact Number", "Adult", "Child", "Pick-up Location", "Drop-off Location", "Remarks"]);
    expect(m).toMatchObject({ bookingNo: 0, productName: 1, serviceDate: 2, pickupTime: 3, customerName: 4, customerPhone: 5, adult: 6, child: 7, pickupAddress: 8, dropoffAddress: 9, memo: 10 });
  });
  it("한글 헤더를 인식한다", () => {
    const m = guessMapping(["주문번호", "상품명", "이용일", "픽업시간", "고객명", "연락처", "인원", "픽업 장소", "하차 장소"]);
    expect(m).toMatchObject({ bookingNo: 0, productName: 1, serviceDate: 2, pickupTime: 3, customerName: 4, customerPhone: 5, pax: 6, pickupAddress: 7, dropoffAddress: 8 });
  });
});

describe("parseDate / parseTime", () => {
  it.each([
    ["2026-09-24", "2026-09-24"],
    ["2026/9/4", "2026-09-04"],
    ["2026년 9월 4일", "2026-09-04"],
    ["24/09/2026", "2026-09-24"],
  ])("%s", (input, out) => expect(parseDate(input)).toBe(out));

  it.each([
    ["09:30", "09:30"],
    ["9:05 PM", "21:05"],
    ["오후 2:10", "14:10"],
    ["12:00 AM", "00:00"],
    ["2026-09-24 07:45", "07:45"],
    ["8시", "08:00"],
  ])("%s", (input, out) => expect(parseTime(input)).toBe(out));

  it("엑셀 시간 소수", () => expect(parseTime(0.5)).toBe("12:00"));
  it("엑셀 Date 셀", () => {
    expect(parseDate(new Date(Date.UTC(2026, 8, 24)))).toBe("2026-09-24");
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 13, 15)))).toBe("13:15");
  });
});

describe("parseRows", () => {
  it("행을 예약으로 변환하고 인원을 합산한다", () => {
    const rows = [
      ["KKday 주문 리스트"],
      ["Order No.", "Product Name", "Date", "Time", "Adult", "Child", "Pick-up Location"],
      ["KK1", "서울 시내 투어 4시간", "2026-09-24", "09:00", 2, 1, "롯데호텔 서울"],
      [null, null, null, null, null, null, null],
      ["KK2", "공항 픽업", "2026-09-24", "", "성인 3", "", "인천공항 T1"],
    ];
    const header = findHeaderRow(rows);
    expect(header).toBe(1);
    const parsed = parseRows(rows, header, guessMapping(rows[header].map(String)));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ bookingNo: "KK1", pax: 3, pickupAt: "2026-09-24T09:00:00+09:00", durationMin: 240 });
    expect(parsed[1].pickupAt).toBeNull();
    expect(parsed[1].pax).toBe(3);
    expect(parsed[1].warnings).toContain("픽업시간을 인식하지 못했습니다");
  });
  it("durationFromText", () => {
    expect(durationFromText("8 hours private tour")).toBe(480);
    expect(durationFromText("공항 샌딩")).toBeNull();
  });
});
