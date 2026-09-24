import { describe, expect, it } from "vitest";
import { areaLocation } from "./areas";
import { tripLabel } from "./format";
import { queryVariants } from "./geocodeQuery";

describe("queryVariants", () => {
  it("한자·국가명·층수를 지우고 도로명까지만 만든다", () => {
    expect(queryVariants("46 Baekjegobun-ro 15-gil, Songpa District, Seoul, 南韓")[0]).toBe("46 Baekjegobun-ro 15-gil, Songpa District, Seoul");
    expect(queryVariants("대한민국 서울특별시 종로구 수표로 91 4F-7F")[0]).toBe("서울특별시 종로구 수표로 91");
    expect(queryVariants("no.402, 65-5 Seongmisan-ro, Mapo-gu, Seoul, 南韓")[0]).toBe("65-5 Seongmisan-ro, Mapo-gu, Seoul");
    expect(queryVariants("대한민국 서울특별시 중구 소공로 116 서울센터빌딩")[0]).toBe("서울특별시 중구 소공로 116");
    expect(queryVariants("南韓 Seoul, Jung District, Chungmu-ro 2-gil, 9 1 층 109 호")[0]).toBe("Seoul, Jung District, Chungmu-ro 2-gil, 9");
  });
});

describe("areaLocation", () => {
  it("구 이름(한/영/한자)과 동네 이름", () => {
    expect(areaLocation("369 Dongho-ro, Jung District, Seoul")?.lat).toBeCloseTo(37.564, 2);
    expect(areaLocation("3-16 Mallijae-ro 6-gil, 麻浦區")?.lng).toBeCloseTo(126.9, 1);
    expect(areaLocation(null, "Hotel Firststay myeongdong")?.lat).toBeCloseTo(37.5637, 3);
    expect(areaLocation("어딘가")).toBeNull();
  });
});

describe("tripLabel", () => {
  it("공항 픽업 = 픽업, 공항 샌딩 = 샌딩", () => {
    expect(tripLabel("공항 픽업")?.label).toBe("픽업");
    expect(tripLabel("공항 샌딩")?.label).toBe("샌딩");
    expect(tripLabel(null)).toBeNull();
  });
});
