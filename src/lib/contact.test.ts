import { describe, expect, it } from "vitest";
import { splitContact } from "./contact";

describe("손님 연락처", () => {
  it("전화번호 + 메모의 메신저, 나머지는 메모로", () => {
    expect(splitContact("+886-983590353", "WECHAT EthanYC_ / 无烟车")).toEqual({ contact: "☎ +886-983590353 / WECHAT EthanYC_", memo: "无烟车" });
    expect(splitContact("+886-982846195", "WECHAT jean51682002 / https://line.me/ti/p/UgR1GMdYLj")).toEqual({
      contact: "☎ +886-982846195 / WECHAT jean51682002 / https://line.me/ti/p/UgR1GMdYLj", memo: null,
    });
    expect(splitContact(null, "피켓 1 / KAKAO abc")).toEqual({ contact: "KAKAO abc", memo: "피켓 1" });
    expect(splitContact(null, null)).toEqual({ contact: null, memo: null });
  });
});
