import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/session";

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
});

describe("세션 토큰", () => {
  const future = Math.floor(Date.now() / 1000) + 60;

  it("서명한 토큰은 통과", async () => {
    const t = await signSession({ u: "user-1", v: 3, e: future });
    expect(await verifySession(t)).toEqual({ u: "user-1", v: 3, e: future });
  });

  it("내용을 바꾸면 거부", async () => {
    const t = await signSession({ u: "user-1", v: 1, e: future });
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin", v: 1, e: future })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it("만료되면 거부", async () => {
    const t = await signSession({ u: "user-1", v: 1, e: Math.floor(Date.now() / 1000) - 1 });
    expect(await verifySession(t)).toBeNull();
  });

  it("다른 키로 서명한 토큰은 거부", async () => {
    const t = await signSession({ u: "user-1", v: 1, e: future });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "other";
    expect(await verifySession(t)).toBeNull();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
  });

  it("엉터리 값은 거부", async () => {
    expect(await verifySession("abc")).toBeNull();
    expect(await verifySession("a.b")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
