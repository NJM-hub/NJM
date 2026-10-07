import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetchAll";

describe("fetchAll", () => {
  const rows = Array.from({ length: 2500 }, (_, i) => i);
  it("서버가 1000건씩만 줘도 끝까지 받는다", async () => {
    const got = await fetchAll(async (from, to) => ({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }));
    expect(got).toEqual(rows);
  });
  it("한 번에 3000건 요청", async () => {
    const calls: [number, number][] = [];
    await fetchAll(async (from, to) => (calls.push([from, to]), { data: rows.slice(from, to + 1), error: null }));
    expect(calls[0]).toEqual([0, 2999]);
  });
});
