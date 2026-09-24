export type ServiceKey = "accident" | "short" | "rent" | "long";
export type IconName = "alert" | "calendar" | "calendarGrid" | "shield" | "building" | "chat" | "car" | "phone";

export type Service = {
  key: ServiceKey;
  href: string;
  name: string;
  /** 상담 폼의 희망 서비스 값 */
  formValue: string;
  pick: string;
  lead: string;
  icon: IconName;
};

export const SERVICES: Service[] = [
  { key: "accident", href: "/accident", name: "사고대차", formValue: "사고대차", pick: "차 수리 기간 동안 탈 차가 필요해요", lead: "수리 기간 동안 타실 차를 보험 처리로 가져다 드립니다.", icon: "alert" },
  { key: "short", href: "/short", name: "단기렌트", formValue: "단기렌트", pick: "하루부터 한 달 안쪽으로 쓸 거예요", lead: "하루부터 30일까지, 필요한 날만큼만 이용하세요.", icon: "calendar" },
  { key: "rent", href: "/rent", name: "월렌트", formValue: "월렌트", pick: "몇 달 동안 월 단위로 탈 거예요", lead: "1개월부터 12개월까지. 보험과 정비를 포함한 월 요금으로 안내합니다.", icon: "calendarGrid" },
  { key: "long", href: "/long", name: "장기렌트", formValue: "장기렌트", pick: "1년 이상 오래 탈 거예요", lead: "1년 이상 이용하실 분께 세금·보험·정비를 포함한 월 요금으로 안내합니다.", icon: "shield" },
];

export const serviceByKey = (key: string) => SERVICES.find((s) => s.key === key);

export const CAR_CATEGORIES = ["경차", "소형", "준중형", "중형", "준대형", "대형", "SUV", "승합", "수입", "전기"] as const;
export const FUELS = ["가솔린", "디젤", "LPG", "하이브리드", "전기"] as const;

export const PERIODS = [
  "1일", "2일", "3일", "4일", "5일", "6일", "1주", "2주", "3주",
  "1개월", "2개월", "3개월", "6개월", "12개월", "2년", "3년", "4년", "5년",
];
