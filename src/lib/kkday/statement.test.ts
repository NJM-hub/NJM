import { describe, expect, it } from "vitest";
import { parseKkdayStatement, withoutVat } from "./statement";

const head = ["여행사 예약 번호", "예약번호", "Transaction Currency", "Transaction Amount", "결제 건수/구매 수량", "종류", "출발날짜", "주문 상태", "Amount in Local Currency"];
const rows = [
  ["시간대는 KKday 본사가 위치한 GMT+8을 기준으로 합니다."],
  head,
  ["", "26KK1", "KRW", "51200", "1/1", "예약 성립", "2026-09-25 (GMT+9)", "취소됨", "51200.00000"],
  ["", "26KK1", "KRW", "-51200", "-", "취소 환불", "2026-09-25 (GMT+9)", "취소됨", "-51200.00000"],
  ["", "26KK2", "KRW", "60000", "1/1", "예약 성립", "2026-09-24 (GMT+9)", "처리 완료", "60000.00000"],
  ["", "26KK3", "KRW", "64200", "1/1", "예약 성립", "2026-09-24 (GMT+9)", "처리 완료", "64200.00000"],
  ["", "26KK3", "KRW", "-9000", "-", "부분 환불", "2026-09-24 (GMT+9)", "처리 완료", "-9000.00000"],
];

describe("KKday 정산내역서", () => {
  it("예약번호별로 예약 성립·취소·부분 환불을 더한다", () => {
    expect(parseKkdayStatement(rows)).toEqual([
      { bookingNo: "26KK1", amount: 0, lines: 2, serviceDate: "2026-09-25", status: "취소됨" },
      { bookingNo: "26KK2", amount: 60000, lines: 1, serviceDate: "2026-09-24", status: "처리 완료" },
      { bookingNo: "26KK3", amount: 55200, lines: 2, serviceDate: "2026-09-24", status: "처리 완료" },
    ]);
  });
  it("부가세 제외 후 외부 금액 차감", () => {
    expect(withoutVat(60000)).toBe(54545);
    expect(withoutVat(60000) - 50000).toBe(4545);
  });
  it("중국어 내역서도 읽는다", () => {
    const zh = [
      ["时区皆以KKday总公司 GMT+8为主"],
      ["供应商订单编号", "订单号码", "Transaction Currency", "Transaction Amount", "类型", "出发日期", "订单状态", "Amount in Local Currency"],
      [null, "26KK9", "KRW", 55200, "订单成立", "2026-08-28 (GMT+9)", "已取消", 55200],
      [null, "26KK9", "KRW", -55200, "取消退款", "2026-08-28 (GMT+9)", "已取消", -55200],
      [null, "26KK8", "KRW", 60000, "订单成立", "2026-08-27 (GMT+9)", "已完成", 60000],
    ];
    expect(parseKkdayStatement(zh)).toEqual([
      { bookingNo: "26KK9", amount: 0, lines: 2, serviceDate: "2026-08-28", status: "已取消" },
      { bookingNo: "26KK8", amount: 60000, lines: 1, serviceDate: "2026-08-27", status: "已完成" },
    ]);
  });
  it("형식이 다르면 오류", () => {
    expect(() => parseKkdayStatement([["a", "b"]])).toThrow();
  });
});
