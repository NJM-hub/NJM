import { describe, expect, it } from "vitest";
import { normalizeTripType } from "./trip";

describe("normalizeTripType", () => {
  it("표기로 판단", () => {
    expect(normalizeTripType("픽업")).toBe("공항 픽업");
    expect(normalizeTripType("샌딩")).toBe("공항 샌딩");
    expect(normalizeTripType("接机")).toBe("공항 픽업");
    expect(normalizeTripType("送机-샌딩")).toBe("공항 샌딩");
    expect(normalizeTripType("공항 픽업")).toBe("공항 픽업");
  });
  it("표기가 없으면 주소로 판단", () => {
    expect(normalizeTripType(null, "마포구 도화길 28", "인천국제공항 T2")).toBe("공항 샌딩");
    expect(normalizeTripType(null, "인천국제공항 T1", "Novotel Dongdaemun")).toBe("공항 픽업");
    expect(normalizeTripType(null, "명동", "홍대")).toBeNull();
  });
});
