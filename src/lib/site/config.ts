/**
 * 홈페이지 회사 정보. 실제 값은 관리자 화면 > 홈페이지 설정에서 입력하며 Supabase site_info 에 저장된다.
 * 아래는 DB 에 값이 없을 때 쓰는 기본값이다. 빈 문자열인 항목은 홈페이지에서 숨긴다.
 */
export type SiteInfo = {
  name: string;
  legalName: string;
  phone: string;
  hours: string;
  accidentHours: string;
  kakaoUrl: string;
  ceo: string;
  brn: string;
  address: string;
  email: string;
  privacyOfficer: string;
};

export const DEFAULT_SITE: SiteInfo = {
  name: "우정렌트카",
  legalName: "",
  phone: "",
  hours: "08:00 ~ 21:00",
  accidentHours: "사고 접수는 24시간 받습니다",
  kakaoUrl: "",
  ceo: "",
  brn: "",
  address: "",
  email: "",
  privacyOfficer: "",
};

export const TAGLINE = "사고대차 · 단기렌트 · 월렌트 · 장기렌트";
export const DESCRIPTION = "사고대차부터 단기렌트, 월렌트, 장기렌트까지. 필요한 서비스를 고르시면 차량과 요금을 바로 안내해 드립니다.";

export const REGIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;
