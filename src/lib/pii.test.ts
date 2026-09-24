import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { birthDateFromRrn, isValidRrn, maskAccount, maskRrn, normalizePhone, normalizeRrn } from "./pii";

describe("pii", () => {
  it("주민번호 검증/마스킹", () => {
    const d = normalizeRrn("900101-1234567")!;
    expect(isValidRrn(d)).toBe(true);
    expect(maskRrn(d)).toBe("900101-1******");
    expect(birthDateFromRrn(d)).toBe("1990-01-01");
    expect(birthDateFromRrn("0503154000000")).toBe("2005-03-15");
    expect(isValidRrn("901301-1234567")).toBe(false);
    expect(normalizeRrn("12345")).toBeNull();
  });
  it("계좌/전화", () => {
    expect(maskAccount("110-123-456789")).toBe("********6789");
    expect(normalizePhone("01012345678")).toBe("010-1234-5678");
    expect(normalizePhone("02-123-4567")).toBeNull();
  });
});

describe("crypto", () => {
  it("암호화 왕복", async () => {
    process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const { encrypt, decrypt } = await import("./crypto");
    const enc = encrypt("9001011234567");
    expect(enc).not.toContain("9001011234567");
    expect(encrypt("9001011234567")).not.toBe(enc); // 매번 다른 IV
    expect(decrypt(enc)).toBe("9001011234567");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-1);
    expect(() => decrypt(tampered)).toThrow();
  });
});
