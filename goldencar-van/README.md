# Golden Car 승합차 렌트 홈페이지

스타리아 하이브리드 **하루 8만원**, 쏠라티 **하루 20만원**을 앞세운 승합차 전문 렌트 홈페이지입니다.
PC·태블릿·휴대폰에 맞춰 화면이 바뀌고, 예약 문의 양식·전화·카카오톡 버튼이 들어 있습니다.

- 기술: Next.js 16 (React 19) · Tailwind CSS 4 · Vercel 배포
- 화면: 홈(가격 강조) · 차량 소개(카드 + 비교표) · 렌트 요금 · 이용 안내(FAQ) · 예약 문의 · 회사 소개 · 개인정보처리방침 · 이용약관
- 검색엔진: 제목·설명·공유 미리보기 이미지, `sitemap.xml`, `robots.txt`, 구조화 데이터(AutoRental)

## ★ 공개 전에 꼭 채울 것

| 무엇 | 파일 | 비워 두면 |
|---|---|---|
| **요금 기준: 기사 포함인지, 차량만 대여인지** (`priceBasis`) | `content/site.ts` | 가격 옆에 "기사 포함 여부 상담 문의" |
| 전화번호, 카카오톡 채널 링크 | `content/site.ts` | 전화·카톡 버튼이 예약 양식으로 연결 |
| 상호·대표자·사업자등록번호·주소 | `content/site.ts` | 하단에 표시 안 함 |
| 대여 조건 8가지 (1일 기준, 보증금, 보험 등) | `content/policies.ts` | "상담 문의" |
| 이용 안내·FAQ 답변 | `content/policies.ts` | "상담 시 안내" |
| 개인정보처리방침·이용약관 본문 | `content/policies.ts` | "준비 중" 안내 |
| 실제 차량 사진 | `public/images/` + `content/vehicles.ts` | 임시 일러스트 |
| 예약 문의 받을 곳 (아래 '예약 문의 연결') | Vercel 환경변수 | 문의가 접수되지 않았다고 안내 |

> 렌트(자동차대여사업)와 기사 포함 운송은 법적으로 다르게 취급됩니다. 요금 기준·운전자격·보험 문구는 실제 등록 형태에 맞게 적어 주세요.
> 좌석 수·연비·연식 등 확인되지 않은 사양은 넣지 않았습니다. 확인된 값만 `content/vehicles.ts` 의 `specs` 에 적으면 비교표에 나옵니다.

## 폴더 구조

```
goldencar-van/
├─ content/            ← 관리자가 고치는 곳 (코드 몰라도 글자만 바꾸면 됨)
│  ├─ site.ts          브랜드·전화·카카오톡·사업자 정보·요금 기준
│  ├─ vehicles.ts      차량·가격·추천 용도·사진 경로·비교표 사양
│  └─ policies.ts      대여 조건·예약 방법·이용 안내·FAQ·약관
├─ app/
│  ├─ page.tsx         메인 페이지 (섹션 조립 + 검색엔진용 구조화 데이터)
│  ├─ layout.tsx       제목·설명·공유 미리보기
│  ├─ api/inquiry/     예약 문의 접수 (서버)
│  ├─ privacy/ terms/  개인정보처리방침·이용약관
│  ├─ opengraph-image.tsx  링크 공유 미리보기 이미지
│  └─ sitemap.ts robots.ts icon.svg
├─ components/         화면 조각 (헤더, 첫 화면, 차량, 요금, 안내, 예약 양식, 하단, 모바일 하단 버튼)
├─ lib/
│  ├─ inquiry.ts       예약 양식 검사 규칙 (화면·서버 공용) + 테스트
│  ├─ deliver.ts       문의를 웹훅/Supabase 로 보내기
│  └─ contact.ts       전화·카톡 링크 만들기
├─ public/images/      차량 사진
└─ supabase/rental_inquiries.sql  (Supabase 사용 시 테이블)
```

## 실행 방법 (내 컴퓨터)

Node.js 20 이상이 필요합니다.

```bash
cd goldencar-van
npm install
npm run dev          # http://localhost:3000
```

확인용 명령: `npm run build` (배포용 빌드) · `npm test` (양식 검사 테스트) · `npm run lint` · `npm run typecheck`

## 배포 방법 (Vercel)

1. [vercel.com](https://vercel.com) → **Add New → Project** → 이 GitHub 저장소(`NJM-hub/NJM`) 선택
2. **Root Directory** 를 `goldencar-van` 으로 지정 (이 저장소에는 다른 앱도 있어서 꼭 필요)
3. **Environment Variables** 에 아래 '예약 문의 연결' 값 입력 → **Deploy**
4. 이후에는 기본 브랜치에 `goldencar-van` 폴더 변경이 올라갈 때만 자동 배포됩니다 (`scripts/vercel-ignore.sh`).

## 도메인 연결 (예: goldencar.co.kr)

1. Vercel 프로젝트 → **Settings → Domains** → 도메인 입력 (`goldencar.co.kr`, `www.goldencar.co.kr`)
2. 도메인을 산 곳(가비아·후이즈 등)의 DNS 설정에 Vercel 이 알려 주는 값을 입력
   - 루트(`@`): **A 레코드** → Vercel 화면에 표시된 IP
   - `www`: **CNAME** → Vercel 화면에 표시된 주소
3. 몇 분~몇 시간 뒤 연결되면 HTTPS 는 자동으로 적용됩니다.
4. `content/site.ts` 의 `url` 을 실제 주소로 맞춥니다 (검색엔진·공유 미리보기용).

> 지금 goldencar.co.kr 에 다른 사이트가 연결되어 있다면, DNS 를 바꾸는 순간 기존 사이트 대신 이 홈페이지가 열립니다.

## 전화 · 카카오톡 연결

`content/site.ts` 에서:

```ts
contact: {
  phone: "010-1234-5678",                         // 휴대폰에서 누르면 바로 전화
  kakaoUrl: "https://pf.kakao.com/_xxxxxx/chat",  // 카카오톡 채널 채팅
  ...
}
```

카카오톡 채널 링크: [카카오톡 채널 관리자센터](https://center-pf.kakao.com) → 내 채널 → 채널 URL 복사 후 끝에 `/chat` 을 붙이면 바로 채팅창이 열립니다.

## 예약 문의 연결

문의 양식은 **실제로 전달된 경우에만 "접수되었습니다"** 를 표시합니다. 연결 전에는 "온라인 접수 준비 중"과 함께 문의 내용 복사 버튼을 보여 줍니다.
Vercel → Settings → Environment Variables 에 아래 중 하나 이상을 넣고 다시 배포하세요.

### 방법 A. 구글 시트로 받기 (가장 쉬움)

1. 구글 시트 새로 만들기 → **확장 프로그램 → Apps Script** → 아래 코드 붙여넣기 → 저장

   ```js
   function doPost(e) {
     const d = JSON.parse(e.postData.contents);
     SpreadsheetApp.getActiveSheet().appendRow([
       new Date(), d.name, d.phone, d.vehicleName, d.startDate, d.endDate, d.purpose, d.notes,
     ]);
     // 휴대폰 알림을 원하면: MailApp.sendEmail("내메일@gmail.com", "Golden Car 렌트 문의", d.text);
     return ContentService.createTextOutput("ok");
   }
   ```

2. **배포 → 새 배포 → 유형: 웹 앱**, 실행: 나, 액세스: **모든 사용자** → 배포 → 웹 앱 URL 복사
3. Vercel 환경변수 `INQUIRY_WEBHOOK_URL` = 그 URL

### 방법 B. 슬랙 · Make · Zapier

웹훅 URL 을 `INQUIRY_WEBHOOK_URL` 에 넣으면 됩니다. 보내는 JSON 의 `text` 에 사람이 읽기 좋은 요약이 들어 있어 슬랙에 그대로 표시됩니다.
나머지 칸: `name, phone, vehicle, vehicleName, startDate, endDate, purpose, notes, receivedAt`

### 방법 C. Supabase 에 저장

1. Supabase SQL Editor 에서 `supabase/rental_inquiries.sql` 실행
2. 환경변수 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 입력 (service role 키는 절대 화면 코드에 넣지 마세요)

A·C 를 함께 쓰면 두 곳 모두로 보내고, 한 곳이라도 성공하면 접수로 처리합니다.

## 차량 사진 바꾸기

1. 실제 차량 사진을 `public/images/` 에 넣습니다 (예: `staria.jpg`, 가로 1200px 이상 권장, 가로:세로 = 5:3).
2. `content/vehicles.ts` 의 `image` 를 `/images/staria.jpg` 로 바꿉니다. 사진은 자동으로 기기에 맞는 크기로 줄여서 보냅니다.

> 직접 찍은 사진을 쓰세요. 현대자동차 공식 사진이나 인터넷 이미지는 사용 조건을 확인한 뒤 써야 합니다.
