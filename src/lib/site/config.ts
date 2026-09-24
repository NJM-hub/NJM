/**
 * 우정렌트카 회사 정보. 홈페이지 헤더·푸터·브랜드소개·상담 안내에 그대로 쓰인다.
 * TODO 표시된 값은 실제 정보로 바꿔 주세요.
 */
export const SITE = {
  name: "우정렌트카",
  legalName: "(주)우정렌트카", // TODO
  tagline: "사고대차 · 단기렌트 · 월렌트 · 장기렌트",
  description: "사고대차부터 단기렌트, 월렌트, 장기렌트까지. 필요한 서비스를 고르시면 차량과 요금을 바로 안내해 드립니다.",
  phone: "010-0000-0000", // TODO 대표번호
  hours: "08:00 ~ 21:00",
  accidentHours: "사고 접수는 24시간 받습니다",
  kakaoUrl: "", // TODO 카카오톡 채널 채팅 URL (예: https://pf.kakao.com/_xxxx/chat). 비워 두면 버튼이 숨겨진다.
  ceo: "대표자명", // TODO
  brn: "000-00-00000", // TODO 사업자등록번호
  address: "본사 주소를 입력하세요", // TODO
  email: "", // TODO 개인정보관리책임자 이메일
  privacyOfficer: "", // TODO 개인정보관리책임자
  regions: ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
};

export const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;
