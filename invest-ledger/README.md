# 투자 회수 장부 (invest-ledger)

투자 실행과 회수를 관리하는 웹 장부입니다. PC와 휴대폰에서 모두 쓸 수 있습니다.

- 기술: Next.js 16 (TypeScript) · Supabase (PostgreSQL) · Vercel 배포
- 전체 구조와 DB 설계: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 개발 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 기본 화면 + 데이터베이스 + 투자 등록/수정/상태변경 + 투자 목록 | ✅ 완료 |
| 2 | 회수계획 자동 생성 + 실제 회수 입력(미회수·연체 기록) | ✅ 완료 |
| 3 | 대시보드(오늘/내일/7일/연체, 만기 알림 색상) + 월별 통계·그래프 + 전체 현황 | ✅ 완료 |
| 4 | 검색·필터·정렬 + 고객별 관리 | ✅ 완료 |
| 5 | 로그인 + 권한(관리자/직원) | 예정 |

---

## 처음 설치하기

두 가지 방법 중 하나를 고르세요.

### 방법 A. 가장 쉬운 방법 (Vercel 안에서 Supabase 연결, 약 10분)

주소·키를 찾아 복사하거나 SQL 을 붙여넣을 필요가 없습니다. 직접 입력하는 것은 **접속 비밀번호 한 줄**뿐입니다.

1. <https://vercel.com/new> → 저장소 **NJM** 옆 **[Import]**
2. **Root Directory** 가 `invest-ledger` 인지 확인
3. **Environment Variables** 에 한 줄만 입력
   - 왼쪽(Key): `BASIC_AUTH_PASSWORD`
   - 오른쪽(Value): 내가 정한 접속 비밀번호 (영문+숫자, 예: `Ledger2026njm`) — 메모해 두기
4. **[Deploy]** (아직 DB 가 없어 화면이 안 나와도 정상)
5. 프로젝트 위쪽 탭 **Storage** → **Create Database** → **Supabase** → Region **Seoul** · 요금제 **Free** → **Create** → **Connect**
   - Supabase 주소·키·DB 주소가 환경변수에 **자동으로** 들어갑니다.
6. **Deployments** 탭 → 맨 위 배포의 **⋯** → **Redeploy** (이때 DB 표가 자동으로 만들어집니다)

### 방법 B. Supabase 를 직접 만든 경우

1. Supabase 에서 새 프로젝트 생성 (Region: **Northeast Asia (Seoul)**)
2. **SQL Editor** → New query → `supabase/migrations/0001_init.sql` 전체 붙여넣기 → **Run** (한 번만)
3. Vercel → **[Import]** → Root Directory `invest-ledger` → Environment Variables 에 4줄 입력

| Key (왼쪽) | Value (오른쪽) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co` — 뒤에 `/rest/v1/` 없이) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → **API Keys** → **Secret key**(`sb_secret_...`) 또는 Legacy 탭의 **service_role** |
| `BASIC_AUTH_USER` | `admin` |
| `BASIC_AUTH_PASSWORD` | 내가 정한 접속 비밀번호 (영문+숫자) |

4. **[Deploy]**

> 🔒 service_role(secret) 키는 **통장 비밀번호 같은 것**입니다. Vercel 환경변수에만 넣고, 카톡·메일·GitHub 에 붙여넣지 마세요.

### 접속
- 배포 주소(예: `https://invest-ledger-xxx.vercel.app`)로 들어가면 아이디/비밀번호를 묻습니다.
- 아이디: `admin` / 비밀번호: `BASIC_AUTH_PASSWORD` 에 넣은 값
- 환경변수를 나중에 바꿨다면 **Deployments** → 최신 배포 **⋯** → **Redeploy** 를 눌러야 적용됩니다.

> 💳 비용: Vercel Hobby + Supabase Free 로 **무료**로 시작할 수 있습니다.
> Supabase 무료 요금제는 1주일 넘게 접속이 없으면 잠시 멈춥니다(대시보드에서 Restore 로 재개).
> 멈추는 것이 싫다면 Supabase 요금제를 **Pro(월 약 25달러)** 로 올리면 됩니다.

### (참고) DB 표 자동 생성
배포할 때 `scripts/migrate.mjs` 가 `supabase/migrations/*.sql` 중 아직 적용 안 된 파일을 자동으로 실행합니다.
DB 주소(`POSTGRES_URL_NON_POOLING`)가 있을 때만 동작하며(방법 A 는 자동으로 생김),
SQL Editor 로 이미 실행해 둔 경우에도 기존 데이터를 건드리지 않고 건너뜁니다.

### (참고) 접속 비밀번호
5단계에서 정식 로그인 화면을 만들기 전까지 사이트 전체를 간단한 아이디/비밀번호로 보호합니다.
`BASIC_AUTH_PASSWORD` 를 넣지 않으면 배포 사이트는 열리지 않도록 막혀 있습니다(안전장치).

---

## 1단계 동작 확인 체크리스트

배포 후 아래를 차례로 해보세요. 모두 되면 2단계로 넘어갑니다.

- [ ] 사이트 접속 시 아이디/비밀번호를 묻고, 맞게 입력하면 **홈** 화면이 보인다
- [ ] **투자 등록** → 아무것도 안 넣고 [투자 등록] → 빨간 안내 문구가 나온다
- [ ] 금액에 `100000000` 입력 → `100,000,000` 으로 쉼표가 자동으로 붙는다
- [ ] 수익률 `20` → "총 회수 예정금액 120,000,000원" 이 자동 표시된다
- [ ] 회수기간 60일/100일/120일/직접 입력을 누르면 만기일이 바뀐다
- [ ] 저장하면 상세 화면으로 이동하고 "저장되었습니다" 가 보인다
- [ ] **투자 목록**에 방금 등록한 건이 보이고, 휴대폰에서는 카드 모양으로 보인다
- [ ] 상세 화면 **정보 수정** → 메모 수정 → 저장된다
- [ ] 상태를 **취소**로 바꾸면 사유를 입력해야 하고, 목록에서 숨겨진다 ([취소 건 포함]을 누르면 다시 보임)
- [ ] Supabase **Table Editor → audit_logs** 에 등록·수정 기록이 쌓여 있다

## 2단계 동작 확인 체크리스트

- [ ] 투자 등록 화면에서 "회수계획 미리보기: 일일 상환 100회, 1회 약 1,200,000원" 처럼 보인다
- [ ] 저장하면 상세 화면 아래 **회수계획** 표에 회차가 자동으로 만들어져 있다 (일일 100일 → 100회)
- [ ] 실행일을 지난 날짜로 등록하면 지난 회차가 빨간색 **연체**로 표시되고, 위쪽 **연체금액** 카드에 합계가 나온다
- [ ] 회차 줄의 **[완납]** → 그 회차가 초록색 **완납**, 실제 회수일·회수금액이 채워진다
- [ ] **입금 등록**에 여러 회차 금액(예: 3,000,000)을 넣으면 "2회차 … 3회차 … 4회차 …"로 나눠질 미리보기가 나오고, 등록하면 그대로 기록된다
- [ ] 일부만 받은 회차는 **일부 입금**(또는 날짜가 지났으면 연체)으로 남고 미회수금액이 보인다
- [ ] **실제 회수내역**에서 [취소] → 사유 입력 → 금액이 빠지고 "취소된 입금 1건 보기"로 기록이 남는다
- [ ] 회차 줄의 **수정** → 예정일·금액·메모를 바꿀 수 있다 / **+ 회차 추가** 로 회차를 늘릴 수 있다
- [ ] 전액을 받으면 상태가 자동으로 **완료**가 된다

### 회수계획 규칙
- 각 회차는 구간의 마지막 날에 받습니다. 마지막 회차는 항상 만기일입니다.
  - 일일: 시작일부터 만기일까지 매일 / 7일·10일 단위: 7일(10일)째 되는 날마다 / 월 단위: 매월 같은 날 전날 / 만기 일시: 만기일 1회
- 회차 금액 = 총 회수 예정금액 ÷ 회차 수 (원 단위 나머지는 마지막 회차에)
- 투자 금액·수익률·방식·기간을 수정하면 회수계획도 새로 만들어집니다. 단, 이미 회차에 입금이 기록돼 있으면 계획은 그대로 두고 안내만 합니다.
- 받지 못한 회차도 지우지 않습니다. 예정일이 지나면 자동으로 **연체**가 되고, 나중에 입금하면 실제 회수일·금액이 채워집니다.
- 2단계는 Supabase 에서 SQL 을 새로 실행할 필요가 없습니다.

## 3단계 동작 확인 체크리스트

- [ ] 첫 화면(**대시보드**) 맨 위에 **오늘 / 내일 / 7일 이내 받을 금액, 연체된 금액**이 보인다
- [ ] **만기·연체 알림**에 색깔별 표시가 나온다: 🟥 연체 · 🔴 만기일 · 🟧 만기 1일 전 · 🟨 만기 3일 전 · 🟡 만기 7일 전
- [ ] **전체 요약**에 총 실행·회수예정·회수완료·미회수, 오늘 예정·오늘 실제 회수, 연체금액·건수, 진행 중·종료 건수가 보인다
- [ ] **오늘 받을 투자** 목록을 누르면 해당 투자 상세 화면으로 간다
- [ ] 메뉴 **월별 통계** → 막대그래프(파랑=투자 실행, 주황=회수)에 마우스를 올리면(휴대폰은 터치) 금액이 뜬다
- [ ] 아래 표에 월별 실행금액·건수, 신규 투자 건수, 회수금액·건수, 미회수금액과 **합계**가 보인다
- [ ] 메뉴 **전체 현황** → 총 미회수금액(큰 숫자), 회수율 막대, 평균 수익률, 진행 중·연체 투자금액, 상태별·회수방식별 표

### 숫자 기준
- 모든 통계에서 **취소** 건은 빠집니다.
- **받을 금액**은 예정 회차 중 아직 안 받은 금액입니다(일부 받았으면 남은 금액만).
- **연체**: 예정일이 지났는데 다 못 받은 회차가 있거나, 만기일이 지났는데 남은 금액이 있는 투자.
- **만기 알림**: 진행 중이고 남은 금액이 있는 투자만 표시합니다.
- **평균 수익률**: 투자금액이 큰 건에 비중을 둔 평균(가중 평균). 건별 단순 평균도 함께 표시합니다.
- **신규 투자 건수**: 그 달 실행 투자 중 해당 고객의 첫 투자인 건.

## 4단계 동작 확인 체크리스트

- [ ] **투자 목록** 검색창에 투자번호·투자 대상명·고객명·연락처를 넣으면 바로 걸러진다 (연락처는 `01012345678`처럼 하이픈 없이도 됨)
- [ ] 필터 버튼 **전체 · 진행중 · 완료 · 연체 · 만기임박 · 취소** 옆에 건수가 나오고, 누르면 해당 건만 보인다
- [ ] 정렬을 **투자 실행일 · 만기일 · 투자금액 · 미회수금액**으로 바꾸고, **오름차순/내림차순**을 바꿀 수 있다
- [ ] 검색·필터·정렬 상태는 주소에 저장되어 새로고침하거나 뒤로 가도 유지된다
- [ ] 메뉴 **고객 관리** → 고객별 투자 건수·총 투자금액·총 회수금액·총 미회수금액·연체 건수가 보인다
- [ ] 고객을 누르면 그 고객의 **모든 투자내역**과 합계가 보인다
- [ ] 고객 화면 **[+ 이 고객 투자 등록]** → 투자 등록 화면에 고객이 미리 선택되어 있다
- [ ] 고객 **정보 수정** (이름·연락처·메모), **미사용으로 변경** (삭제 대신, 투자 등록의 고객 선택 목록에서만 빠짐)
- [ ] 투자 상세 화면의 고객명을 누르면 고객 화면으로 간다

### 기준
- **연체** 필터: 예정일이 지났는데 못 받은 회차가 있거나, 만기가 지났는데 남은 금액이 있는 진행 중 투자
- **만기임박** 필터: 만기까지 7일 이내이고 남은 금액이 있는 진행 중 투자 (연체 건은 연체 필터에)
- 고객별 합계와 연체 건수에서 **취소**된 투자는 빠집니다 (목록에는 흐리게 표시)

---

## 내 컴퓨터에서 실행하기 (선택)

필요한 것: [Node.js 22 LTS](https://nodejs.org)

```bash
cd invest-ledger
cp .env.example .env.local     # 만든 .env.local 파일을 열어 값을 채웁니다
npm install
npm run dev                    # http://localhost:3000 접속
```

- 내 컴퓨터(개발 모드)에서는 `BASIC_AUTH_PASSWORD` 를 비워두면 비밀번호 없이 열립니다.
- `.env.local` 은 `.gitignore` 에 들어 있어 GitHub 에 올라가지 않습니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 배포용 빌드 (Vercel 이 자동으로 실행) |
| `npm test` | 계산 로직 테스트 |
| `npm run typecheck` / `npm run lint` | 코드 검사 |

## 폴더 구조

```
invest-ledger/
├─ app/                              화면
│  ├─ layout.tsx                     공통 틀 (메뉴)
│  ├─ page.tsx                       대시보드 (받을 금액, 만기·연체 알림)
│  ├─ overview/page.tsx              전체 현황
│  ├─ stats/page.tsx                 월별 통계 + 그래프
│  ├─ customers/                     고객 목록 / [id] 고객 상세 / [id]/edit 수정 / actions.ts
│  ├─ error.tsx / not-found.tsx      오류 안내 화면
│  └─ investments/
│     ├─ page.tsx                    투자 목록
│     ├─ actions.ts                  저장·수정·상태변경 (서버)
│     ├─ repayment-actions.ts        입금·완납·입금취소·회차 수정 (서버)
│     ├─ new/page.tsx                투자 등록
│     └─ [id]/page.tsx, edit/page.tsx  상세(회수계획·입금) / 수정
│        └─ schedules/[sid], new       회차 수정 / 회차 추가
├─ components/                       화면 조각
│  ├─ AppShell.tsx                   네이비 메뉴 (PC 왼쪽 / 휴대폰 위쪽)
│  ├─ InvestmentForm.tsx             투자 입력폼 (자동 계산)
│  ├─ ScheduleTable.tsx              회차별 회수계획 표 (완납 버튼, 연체 표시)
│  ├─ PaymentForm.tsx                입금 등록 (자동 배분 / 회차 지정)
│  ├─ RepaymentList.tsx              실제 회수내역 (입금 취소)
│  ├─ ScheduleForm.tsx               회차 수정·추가
│  ├─ MonthlyChart.tsx               월별 막대그래프
│  ├─ AlertList.tsx, AlertBadge.tsx  만기·연체 알림 (색상 구분)
│  ├─ ListControls.tsx               검색창 + 정렬 선택
│  ├─ CustomerForm.tsx, CustomerStatusButton.tsx  고객 수정·미사용 전환
│  ├─ StatusChangeForm.tsx           상태 변경
│  └─ StatCard.tsx, StatusBadge.tsx, PageHeader.tsx, SubmitButton.tsx
├─ lib/
│  ├─ calc.ts                        회수 예정금액·만기일·회수율 계산
│  ├─ schedule.ts                    회차 예정일·금액 만들기, 입금 자동 배분
│  ├─ ledger.ts                      회수계획 저장·완료 상태 자동 변경
│  ├─ stats.ts                       대시보드·월별·전체 현황 계산, 만기 알림 등급
│  ├─ listing.ts                     투자 목록 검색·필터·정렬, 고객별 합계
│  ├─ format.ts                      원화 표시 (100,000,000원)
│  ├─ dates.ts                       날짜 (한국 시간)
│  ├─ validate.ts                    입력값 검사
│  ├─ queries.ts                     DB 조회
│  ├─ supabase.ts / env.ts           DB 연결 / 환경변수
│  └─ constants.ts, types.ts         선택지·타입
├─ supabase/migrations/0001_init.sql DB 테이블·뷰·보안 설정
├─ scripts/migrate.mjs               배포 시 DB 표 자동 생성
├─ proxy.ts                          접속 비밀번호 확인
└─ docs/ARCHITECTURE.md              구조·DB 설계 설명
```

## 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| "화면을 불러오지 못했습니다" | 방법 A: Storage 에 Supabase 연결 후 Redeploy 했는지 / 방법 B: 환경변수 2개(Supabase URL, secret 키) 확인 → Redeploy |
| "relation ... does not exist" / "Could not find the table" | 방법 A: Redeploy / 방법 B: SQL Editor 에서 `0001_init.sql` 실행 |
| "BASIC_AUTH_PASSWORD 환경변수를 설정해야…" | Vercel 환경변수에 `BASIC_AUTH_PASSWORD` 추가 → Redeploy |
| 비밀번호를 맞게 넣어도 계속 물어봄 | 비밀번호에 한글이 있으면 안 됩니다. 영문·숫자로 바꾸세요 |
| Vercel 빌드가 다른 앱으로 됨 | Vercel → Settings → General → **Root Directory** 가 `invest-ledger` 인지 확인 |
