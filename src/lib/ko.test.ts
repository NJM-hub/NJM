import { describe, expect, it } from "vitest";
import { ko } from "./ko";

describe("한국어 표시", () => {
  it("기사 이름은 차량 메모의 한글 이름과 같게", () => {
    expect(["金基峰", "车秀荣", "全华峰", "佟晓川", "孙学松", "金石岗", "林杰", "吕浩然", "张益哲", "金炜东", "金龙喆"].map((s) => ko(s))).toEqual([
      "김기봉", "차수영", "전화봉", "동효천", "손학송", "김석강", "임걸", "여호연", "장익철", "김위동", "김용철",
    ]);
  });

  it("자체 콜 내용", () => {
    expect(ko("7点30分汝矣岛送机仁川")).toBe("7시 30분 여의도 샌딩 인천");
    expect(ko("13点明洞送仁川")).toBe("13시 명동 샌딩 인천");
    expect(ko("市内包车80000")).toBe("시내 전세80000");
    expect(ko("12:55金普接机")).toBe("12:55김포 픽업");
    expect(ko("下午2点30开始半天包车")).toBe("오후 2시 30분 시작 반일 전세");
  });

  it("호텔·주소·요청 사항", () => {
    expect(ko("首爾君悅酒店")).toBe("그랜드 하얏트 서울");
    expect(ko("23-1 Eulji-ro 19-gil, Jung District, Seoul, 韩国")).toBe("23-1 Eulji-ro 19-gil, Jung District, Seoul, 한국");
    expect(ko("廣津區华阳洞37-89")).toBe("광진구화양동37-89");
    expect(ko("儿童座椅*1，举牌接机*0")).toBe("어린이 좌석*1, 피켓*0");
    expect(ko("降落60~90分后出发，司机协商")).toBe("착륙 60~90분 후 출발, 기사와 협의");
    expect(ko("Test Hotel")).toBe("Test Hotel");
    expect(ko(null)).toBeNull();
  });
});
