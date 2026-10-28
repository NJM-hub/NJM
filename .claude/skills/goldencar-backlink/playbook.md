# Platform Playbook

버전: **v1.1 (2026-10-28)** — 규칙을 바꾸면 아래 변경 이력에 한 줄 추가하고, 로그의 `playbook_version`에 반영한다.

이 문서의 양식은 GOLDENCAR용 초기 템플릿이다. 각 플랫폼의 현재 게시 정책과 허용 링크 형식은 게시 전에 확인한다.
백링크 개수보다 콘텐츠 관련성, 실제 공개 여부, 링크 정상 작동, 유입 성과를 기준으로 관리한다.

## 공통 규칙

- 플랫폼마다 제목·본문·링크·태그 형식을 따로 지킨다 (아래 플랫폼별 양식).
- 게시물마다 언어와 타깃 국가를 정한다.
- **타깃 URL은 게시물 주제와 직접 관련된 GOLDENCAR 페이지 하나**를 쓴다. 링크는 1개가 기본이다.
  - 언어와 URL을 맞춘다: 영어 글 → `/en/...`, 일본어 글 → `/ja/...`, 한국어 글 → `/ko/...`.
  - 주제와 맞춘다: 공항 이동 → `/airport`, 투어 → `/tour`, 의전·기사 → `/protocol`, 렌터카 → `/rentcar`. 홈(`/{locale}`)은 브랜드 소개 글에만.
- 같은 본문을 여러 플랫폼에 그대로 복사하지 않는다. 같은 주제라도 플랫폼 양식에 맞게 새로 쓴다.
- 링크는 서비스가 필요한 문맥에 자연스럽게 넣는다. 홍보 링크만 반복하지 않는다.
- 실제 사업 실적·고객 경험·후기를 확인 없이 사례처럼 꾸며 쓰지 않는다. `facts.md`에 있는 사실만 쓴다.
- 소셜(LinkedIn, Facebook, Pinterest) 링크에는 UTM: `?utm_source={플랫폼}&utm_medium=social&utm_campaign=backlink`. 블로그형(Medium, Tumblr, 네이버 블로그·카페, Blogger, note 등)은 깨끗한 URL.
- 이미지는 권리와 출처가 확인된 것만. 실제 사진이 없으면 "이미지 제안"만 적는다.
- 게시 여부, 링크 클릭 가능 여부, 공개 상태는 각각 따로 기록한다.

## 플랫폼 목록

| 코드 | 플랫폼 | 주 언어 | 용도 | 지원 상태 |
|---|---|---|---|---|
| MED | Medium | EN (다른 언어 가능) | 해외 검색 유입용 정보성 장문 | 검증 필요 |
| LIN | LinkedIn | EN (다른 언어 가능) | 전문성·사업 인사이트 | 검증 필요 |
| NBL | 네이버 블로그 | KO | 한국어 여행 정보 | 검증 필요 |
| NCF | 네이버 카페 | KO | 커뮤니티 정보 공유 (카페 규칙 확인 필수) | 검증 필요 |
| TUM | Tumblr | EN JA | 짧은 가이드·이미지 중심 | 검증 필요 |
| FB | Facebook 페이지 | 전 언어 | 팔로워·공유 유입 | 검증 필요 |
| BLG | Blogger | 전 언어 | 구글 색인용 블로그 (추천) | 검증 필요 |
| PIN | Pinterest | EN JA TH | 이미지 핀 + 목적지 링크 (추천) | 검증 필요 |
| PIX | PIXNET 痞客邦 | TW | 대만 블로그 (추천) | 검증 필요 |
| NOTE | note | JA | 일본 글 플랫폼 (추천) | 검증 필요 |
| HTN | Hatena Blog | JA | 일본 블로그 (추천) | 검증 필요 |

`검증 필요`는 실제 계정으로 한 번 게시·링크 클릭을 확인한 뒤 `확인됨 (YYYY-MM-DD)`로 바꾼다.
링크 속성(nofollow 등)은 미리 적지 않고 게시 후 실제 HTML로 확인한다.

제외·보류: Reddit(운영 대상 아님), Quora·Pantip·Dcard 등 포럼(홍보 규정이 엄격해 보류), 小红书(외부 링크 클릭 불가, 별도 브랜드 작업).

---

## 1. MED — Medium (영어·해외 검색 유입용)

양식:
```
[TITLE]
[SUBTITLE]
[BODY]
  Introduction — 여행객이 겪는 문제, 준비할 때 고려할 점
  1. 소제목 — 주제의 첫 번째 핵심
  2. 소제목 — 일행 규모·수하물·목적에 따른 선택 기준 등
  3. 소제목 — 일정·도착 시간·숙소 위치 등 계획
  4. Final Checklist — 예약 전 확인 사항 목록
[LINK]  본문 중간, 서비스가 필요한 문맥에 1개
[ENDING]  요약과 독자에게 유용한 마무리
[TAGS]  3~5개, 일반 텍스트, # 없음
```

예시:
```
[TITLE]
A Practical Guide to Airport Transfers in Seoul, South Korea

[SUBTITLE]
What international travelers should know before arriving in Korea.

[LINK]
Explore available airport transfer options: https://goldencar.co.kr/en/airport

[TAGS]
Korea Travel
Seoul Travel
Airport Transfer
South Korea
Travel Tips
```

규칙:
- 정보성 장문. 영어 800~1,500단어 / CJK 2,000~3,500자. 소제목 사용.
- 태그 3~5개, 일반 텍스트, `#` 없음.

## 2. LIN — LinkedIn (전문성·사업 인사이트용)

양식 (순서 고정):
```
첫 문장: 관심을 끄는 한 줄
문제 제기 1~2문장
핵심 정보 2~3개 (번호 목록)
한 줄 정리
링크 안내 문장 + URL
독자에게 던지는 질문
해시태그 3~5개 (# 붙임)
```

예시:
```
Arriving in Seoul? Plan Your Airport Transfer Before You Fly.

Travel planning doesn't end with booking a flight and hotel. International travelers should also consider arrival time, luggage, group size, and the distance to their accommodation.

Here are three things to check before choosing an airport transfer:
1. Confirm your arrival airport and terminal.
2. Choose a vehicle that fits your group and luggage.
3. Check pickup instructions and waiting-time policies before booking.

Planning transportation in advance can make the first part of a Korea trip much easier.

Explore transportation options for your Korea trip:
https://goldencar.co.kr/en/airport?utm_source=linkedin&utm_medium=social&utm_campaign=backlink

How do you usually plan airport transportation when traveling abroad?

#KoreaTravel #SeoulTravel #AirportTransfer #TravelPlanning
```

규칙:
- 첫 문장으로 관심 유도 → 핵심 정보 2~3개 → 관련 링크 → 질문.
- 해시태그는 `#`을 붙여 3~5개.
- 사업 실적·고객 경험을 확인 없이 사례처럼 쓰지 않는다.
- 일반 텍스트만 (마크다운 없음). 길이 600~1,300자 안팎.
- 본문 링크가 노출에 미치는 영향은 검증 필요. 가끔 "첫 댓글 링크"와 비교해 notes에 기록.

## 3. NBL — 네이버 블로그 (한국어 여행 정보용)

양식 (순서 고정):
```
[제목]
[도입부]
[소제목 1] 확인할 사항 (목록)
[소제목 2] 선택 기준·비교
[소제목 3] 예약 전 체크리스트 (목록)
[마무리]
[관련 서비스] 안내 문장 + URL
[태그] # 없이, 쉼표 구분
```

예시:
```
[제목]
인천공항에서 서울 숙소까지, 한국 여행 전 알아두면 좋은 교통 준비

[도입부]
한국 여행을 준비할 때 항공권과 숙소만큼 중요한 것이 공항에서 숙소까지의 이동 계획입니다. 도착 시간과 인원, 수하물에 따라 적합한 이동 방법이 달라질 수 있습니다.

[소제목 1] 공항 이동 전 확인할 사항
- 인천공항 또는 김포공항 도착 여부
- 항공편과 도착 시간
- 여행 인원 및 수하물
- 숙소 주소와 이동 거리

[소제목 2] 일행에 맞는 이동 방법 선택
여행 인원과 일정에 따라 대중교통, 택시, 사전 예약 차량 등의 장단점을 비교합니다.

[소제목 3] 예약 전 체크리스트
- 픽업 장소
- 차량 인원 및 수하물 적재 가능 여부
- 대기 시간 및 추가 요금 조건
- 예약 변경 및 취소 규정

[마무리]
출발 전에 이동 계획을 확인하면 도착 후 불필요한 혼란을 줄이는 데 도움이 됩니다.

[관련 서비스]
한국 공항 이동 및 차량 서비스 안내
https://goldencar.co.kr/ko/airport

[태그]
한국여행, 인천공항, 공항픽업, 서울여행, 프라이빗투어
```

규칙:
- 제목 → 도입부 → 소제목별 정보 → 체크리스트 → 관련 링크 → 태그.
- 태그는 `#` 없이.
- 실제 이용 후기처럼 쓰지 않고 여행 정보형으로.
- 길이 1,500~3,000자.

## 4. NCF — 네이버 카페 (커뮤니티 정보 공유용)

양식:
```
[제목]  질문 또는 여행 팁 형태
[본문]
  상황 소개 1~2문장
  체크 항목 3~5개 (번호 목록)
  한 줄 조언
  (카페 규칙상 허용될 때만) 링크 안내 문장 + URL
[태그]  # 없이, 2~4개
```

규칙:
- 질문이나 여행 팁 중심. 짧게 (500~1,000자).
- **게시 전 해당 카페의 홍보·링크 규칙을 먼저 확인한다.** 광고성 링크가 금지면 링크 없이 게시하거나 게시하지 않는다. 규칙을 모르면 큐 결과에 `카페 규칙 확인 필요`를 표시하고, 링크 없는 버전도 함께 준다.
- 태그는 `#` 없이.
- 작성자가 골든카 관계자임을 숨기지 않는다.

## 5. TUM — Tumblr (해외 여행 콘텐츠·짧은 가이드용)

양식:
```
[TITLE]
[BODY]
  짧은 도입 질문 1줄
  체크 목록 4~6개
  한 줄 정리
  링크 안내 문장 + URL
[TAGS]  5~10개, 일반 텍스트, # 없음, 중요한 것부터
```

예시:
```
[TITLE]
Planning Your Arrival in Seoul: An Airport Transfer Checklist

[BODY]
Traveling to Seoul soon?

Before you arrive, make sure you have checked:
- Your arrival airport and terminal
- Your hotel address
- The number of passengers and bags
- Your preferred transportation option
- Pickup instructions and booking conditions

A little preparation can make airport arrival smoother, especially when traveling with family or a group.

Korea airport transportation information:
https://goldencar.co.kr/en/airport

[TAGS]
Korea Travel
Seoul
Airport Transfer
Travel Tips
South Korea
```

규칙:
- 짧은 문단, 목록, 이미지와 함께 읽기 쉽게. 영어 150~400단어 / 일본어 400~1,000자.
- 태그는 `#` 없이.
- 이미지는 권리와 출처 확인.

## 6. 기타 플랫폼 (v1.0 규칙 유지)

### FB — Facebook 페이지
- 300~700자, 첫 문장에 질문이나 상황 제시, 링크 1개(UTM), 해시태그 2~4개(# 붙임).
- 게시 후 링크 미리보기 카드의 제목·이미지가 언어에 맞게 나오는지 확인.
- 그룹 게시는 그룹 규칙에서 홍보 허용 확인 전 금지.

### BLG — Blogger
- Medium과 비슷한 장문이되 주제·구성을 다르게. 검색 설명(150자 안팎), 라벨 3~5개. 언어별 블로그 분리 권장.

### PIN — Pinterest
- 제목 100자 이내, 설명 500자 이내(공식 기준, 검증일 기록 필요), 세로 2:3 이미지, 목적지 링크 1개(UTM). 실제 사진 없으면 보류.

### PIX — PIXNET / NOTE — note / HTN — Hatena Blog
- 현지 블로그 장문(1,500~4,000자). 현지 표현 사용(대만: 保母車·九人座·接送 / 일본: です・ます체). 태그·카테고리 3~5개. 링크 1개.

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.0 | 2026-10-28 | 최초 작성. 운영 4개 + 추천 6개 플랫폼 |
| v1.1 | 2026-10-28 | 사용자 제공 양식 반영: Medium·LinkedIn·네이버 블로그·네이버 카페·Tumblr 게시 양식과 예시. 네이버 블로그·카페 추가. 링크 1개 기본, 언어·주제에 맞는 URL 원칙. 상태값 Draft/Reviewed/Approved/Published 도입 |
