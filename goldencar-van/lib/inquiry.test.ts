import { describe, expect, it } from "vitest";
import { emptyInquiry, parseInquiry, rentalDays, summarizeInquiry, todayKst, validateInquiry, type InquiryInput } from "./inquiry";

const now = new Date("2026-10-21T03:00:00Z"); // KST 12:00
const valid: InquiryInput = {
  name: "홍길동",
  phone: "010-1234-5678",
  vehicle: "staria",
  startDate: "2026-10-25",
  endDate: "2026-10-27",
  purpose: "가족 여행",
  notes: "",
  consent: true,
};

describe("validateInquiry", () => {
  it("accepts a complete inquiry", () => {
    expect(validateInquiry(valid, now)).toEqual({});
  });

  it("requires every field and consent", () => {
    const e = validateInquiry(emptyInquiry, now);
    expect(Object.keys(e).sort()).toEqual(["consent", "endDate", "name", "phone", "purpose", "startDate", "vehicle"]);
  });

  it("rejects malformed phone numbers", () => {
    expect(validateInquiry({ ...valid, phone: "1234" }, now).phone).toBeTruthy();
    expect(validateInquiry({ ...valid, phone: "010-abcd-5678" }, now).phone).toBeTruthy();
    expect(validateInquiry({ ...valid, phone: "+82 10 1234 5678" }, now).phone).toBeUndefined();
  });

  it("rejects past start dates using Korean time", () => {
    // 2026-10-20 23:30 UTC = 2026-10-21 08:30 KST
    const lateUtc = new Date("2026-10-20T23:30:00Z");
    expect(todayKst(lateUtc)).toBe("2026-10-21");
    expect(validateInquiry({ ...valid, startDate: "2026-10-20", endDate: "2026-10-22" }, lateUtc).startDate).toBeTruthy();
    expect(validateInquiry({ ...valid, startDate: "2026-10-21", endDate: "2026-10-22" }, lateUtc).startDate).toBeUndefined();
  });

  it("rejects return before start and impossible dates", () => {
    expect(validateInquiry({ ...valid, endDate: "2026-10-24" }, now).endDate).toBeTruthy();
    expect(validateInquiry({ ...valid, startDate: "2026-02-30" }, now).startDate).toBeTruthy();
  });

  it("rejects unknown vehicles and purposes", () => {
    expect(validateInquiry({ ...valid, vehicle: "bus" }, now).vehicle).toBeTruthy();
    expect(validateInquiry({ ...valid, purpose: "의전" }, now).purpose).toBeTruthy();
  });
});

describe("parseInquiry", () => {
  it("coerces untrusted JSON", () => {
    expect(parseInquiry(null)).toBeNull();
    expect(parseInquiry({ name: 1, consent: "true" })).toEqual({ ...emptyInquiry });
  });
});

describe("rentalDays / summary", () => {
  it("counts days with same-day return as 1", () => {
    expect(rentalDays("2026-10-25", "2026-10-25")).toBe(1);
    expect(rentalDays("2026-10-25", "2026-10-27")).toBe(2);
    expect(rentalDays("2026-10-27", "2026-10-25")).toBeNull();
  });

  it("summarizes with the vehicle name", () => {
    const s = summarizeInquiry(valid);
    expect(s).toContain("현대 스타리아 하이브리드");
    expect(s).toContain("2026-10-25 ~ 2026-10-27 (2일)");
  });
});
