# 투자 장부 (invest-ledger)

투자 실행과 회수를 관리하는 웹 장부 프로그램입니다.
PC와 휴대폰에서 모두 쓸 수 있고, GitHub에 저장해 Vercel로 배포하며, 데이터는 Supabase(PostgreSQL)에 저장합니다.

- 기술 스택: Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel
- 현재 단계: **1단계 (기본 화면 + 데이터베이스 + 투자등록)**

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 기본 화면 + 데이터베이스 + 투자 등록/수정/상태변경 | ✅ 완료 |
| 2 | 회수계획 자동 생성 + 실제 회수 입력 (미회수/연체 기록) | 다음 |
| 3 | 대시보드(오늘/내일/7일 이내/연체) + 월별 통계·그래프 + 전체 현황 + 만기 알림 색상 | |
| 4 | 검색 + 필터 + 정렬 + 고객별 관리 | |
| 5 | 로그인 + 권한관리 (관리자/직원) | |

---

## 1. 전체 시스템 구조

```
[브라우저 (PC/휴대폰)]
        │  ① 아이디/비밀번호 확인 (proxy.ts, 5단계 전까지 임시 보호)
        ▼
[Vercel — Next.js 서버]
   ├─ 화면 (app/…/page.tsx)       : 서버에서 데이터를 읽어 HTML 로 그려서 보냄
   ├─ 저장 기능 (app/…/actions.ts) : 입력값 검사 → DB 저장 (Server Action)
   └─ lib/supabase/server.ts      : 비밀키로 Supabase 접속 (서버에서만)
        │
        ▼
[Supabase — PostgreSQL]
   ├─ 테이블 : customers, investments, repayment_schedules, repayments, profiles
   ├─ 뷰    : investment_summary, schedule_status (회수금액·회수율·연체 자동 계산)
   └─ 보호  : 삭제 금지 트리거 + RLS (브라우저 공개키로는 아무것도 못 읽음)
```

- **비밀키는 서버에만** 있습니다. 브라우저로는 화면(HTML)만 전달되므로 고객 연락처 등이 외부에 직접 노출되지 않습니다.
- 금액 계산(회수금액, 남은금액, 회수율, 연체금액)은 **DB 뷰에서 한 번에 계산**합니다. 화면·통계·엑셀이 모두 같은 숫자를 쓰게 됩니다.

### 폴더 구조

```
invest-ledger/
├─ app/                          화면 (주소 = 폴더 경로)
│  ├─ layout.tsx                 공통 틀 (왼쪽 메뉴)
│  ├─ page.tsx                   /                 대시보드
│  ├─ globals.css                색상·공통 스타일 (네이비/화이트)
│  ├─ error.tsx / not-found.tsx  오류·404 화면
│  └─ investments/
│     ├─ page.tsx                /investments      투자 목록
│     ├─ actions.ts              투자 저장/수정/상태변경 (서버에서 실행)
│     ├─ new/page.tsx            /investments/new  투자 등록
│     └─ [id]/
│        ├─ page.tsx             /investments/123  투자 상세
│        └─ edit/page.tsx        /investments/123/edit 투자 수정
├─ components/                   화면 조각
│  ├─ Sidebar.tsx                메뉴 (PC 왼쪽 / 휴대폰 상단)
│  ├─ InvestmentForm.tsx         투자 등록·수정 입력폼 (자동 계산 미리보기)
│  ├─ StatCard.tsx               숫자 카드
│  ├─ StatusBadge.tsx            상태 표시 (진행중/완료/취소/연체)
│  ├─ StatusActions.tsx          완료·취소 처리 버튼
│  └─ EnvNotice.tsx              환경변수 누락 안내
├─ lib/                          계산·데이터 처리
│  ├─ calc.ts                    총 회수 예정금액, 만기일, 회수 횟수, 회수율
│  ├─ dates.ts                   한국시간 오늘, 날짜 더하기
│  ├─ format.ts                  100,000,000원 표시, 입력값 해석
│  ├─ constants.ts               회수방식·상태 이름표 (엑셀 머리글에도 사용)
│  ├─ investmentForm.ts          입력값 검사
│  ├─ queries.ts                 DB 조회
│  ├─ types.ts                   데이터 형태 정의
│  ├─ env.ts                     환경변수 확인
│  └─ supabase/server.ts         Supabase 접속 (서버 전용)
├─ supabase/migrations/
│  └─ 0001_init.sql              DB 전체 구조 (Supabase SQL Editor 에서 실행)
├─ proxy.ts                      사이트 비밀번호 보호
└─ .env.example                  환경변수 예시
```

---

## 2. 데이터베이스 구조

```
customers (고객)
   │ 1
   │
   │ N
investments (투자) ──1───N── repayment_schedules (회수계획: 회차별 예정일·예정금액)
   │ 1                              │ 1
   │                                │
   │ N                              │ N (선택: 어느 회차에 대한 입금인지)
repayments (실제 회수내역: 실제 입금일·금액) ──┘

auth.users (로그인 계정) 1──1 profiles (권한: admin/staff/viewer)  ← 5단계
```

### customers — 고객정보
| 컬럼 | 설명 |
|---|---|
| id | 고유번호 (자동) |
| name | 고객명 |
| phone | 연락처 |
| memo | 메모 |
| status | `active` 사용 / `inactive` 비활성 (삭제 대신) |

### investments — 투자정보
| 컬럼 | 설명 |
|---|---|
| investment_no | 투자번호. 비워두면 `INV-2026-0001` 형식으로 자동 부여 |
| customer_id | 고객 (customers 연결) |
| target_name | 투자 대상명 |
| executed_on | 투자 실행일 |
| principal | 투자 실행금액 (원) |
| return_rate | 수익률 (%) |
| expected_total | **총 회수 예정금액 (자동 계산)** = 투자금액 × (1 + 수익률%) |
| repayment_method | 회수방식: `daily` 일일 / `every7` 7일 단위 / `every10` 10일 단위 / `monthly` 월 단위 / `bullet` 만기 일시상환 |
| term_days | 회수기간(일), 기본 100 |
| start_on / maturity_on | 회수 시작일 / 회수 만기일 |
| memo | 메모 |
| status | `active` 진행중 / `completed` 완료 / `cancelled` 취소 (삭제 대신) |

### repayment_schedules — 회수계획 (2단계에서 화면 연결)
| 컬럼 | 설명 |
|---|---|
| investment_id | 어느 투자의 계획인지 |
| seq | 회차 (1, 2, 3 …) |
| due_on | 예정 회수일 |
| expected_amount | 예정 회수금액 |
| memo | 메모 |
| status | `active` / `cancelled`(계획 변경으로 무효) |

돈을 받지 못해도 **회차는 지우지 않고 그대로 남습니다.** 실제 회수내역과 비교해서 `예정 / 오늘 / 연체 / 일부회수 / 완납`이 자동으로 판정됩니다.

### repayments — 실제 회수내역 (2단계에서 화면 연결)
| 컬럼 | 설명 |
|---|---|
| investment_id | 어느 투자의 입금인지 |
| schedule_id | 어느 회차에 대한 입금인지 (선택) |
| paid_on | 실제 회수일 |
| amount | 실제 회수금액 |
| status | `valid` 정상 / `void` 무효 (잘못 입력했을 때, 삭제 대신) |

### 자동 계산 뷰
- **investment_summary** (투자 건별): 현재까지 회수금액, 남은 회수금액, 회수율, 경과일수, 남은 회수기간, 연체금액
  - 연체금액 = (어제까지 받기로 한 금액 합계) − (지금까지 실제로 받은 금액), 0보다 작으면 0
  - 예) 투자 100,000,000원 · 수익률 20% → 총 회수 예정 120,000,000원, 70,000,000원 회수 시 남은 금액 50,000,000원 · 회수율 58.33%
- **schedule_status** (회차별): 회차별 받은 금액, 미회수금액, 상태

### 데이터 보호
- 고객·투자·회수계획·회수내역 4개 표는 **DB에서 DELETE 자체가 막혀 있습니다.** 실수로 지울 수 없고, 필요하면 상태를 `취소/비활성/무효`로 바꿉니다.
- 모든 표에 RLS(행 단위 보안)가 켜져 있어, 브라우저용 공개키로는 데이터를 읽을 수 없습니다.

### 향후 확장
- **직원 계정 (5단계)**: `profiles` 표가 이미 준비되어 있어 로그인만 붙이면 `admin/staff/viewer` 권한을 나눌 수 있습니다. 각 표의 `created_by` 로 누가 입력했는지 기록합니다.
- **엑셀 내보내기**: `investment_summary` 뷰가 이미 “한 줄 = 투자 1건 + 계산값” 형태이고, `lib/constants.ts` 에 한글 이름표가 있으므로 그대로 엑셀 시트로 만들 수 있습니다.

---

## 3. 설치 및 배포 방법 (처음 한 번)

> 개발자가 아니어도 순서대로 따라 하면 됩니다. 명령어 입력은 필요하지 않습니다(4번 “내 컴퓨터에서 실행”은 선택).

### 3-1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 가입 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database Password: 아무 값이나 정하고 안전한 곳에 보관
2. 프로젝트가 만들어지면 왼쪽 메뉴 **SQL Editor** → **New query**
3. 이 저장소의 `invest-ledger/supabase/migrations/0001_init.sql` 파일 내용을 **전부 복사해서 붙여넣고 Run**
   - 아래쪽에 `Success. No rows returned` 가 나오면 성공입니다.
   - ⚠️ 이 SQL 은 **한 번만** 실행합니다. 두 번 실행하면 “already exists” 오류가 나는데, 이미 만들어졌다는 뜻이니 무시해도 됩니다.
4. 왼쪽 **Table Editor** 에 `customers`, `investments`, `repayment_schedules`, `repayments`, `profiles` 가 보이면 완료
5. **Project Settings → API Keys** 에서 두 값을 복사해 둡니다.
   - **Project URL** (예: `https://abcdxyz.supabase.co`) — Project Settings → Data API 또는 API 화면에 있습니다.
   - **Secret key** (`sb_secret_…`) — 없으면 “Legacy API keys” 탭의 **service_role** 키를 써도 됩니다.
   - ⚠️ Secret key 는 DB 전체 권한을 가진 열쇠입니다. 다른 사람에게 보내거나 코드에 직접 적지 마세요.

### 3-2. Vercel 에 배포하기

1. [vercel.com](https://vercel.com) 에 GitHub 계정으로 로그인 → **Add New… → Project**
2. 이 GitHub 저장소(`NJM`)를 **Import**
3. ⚠️ **Root Directory** 옆 **Edit** 를 눌러 **`invest-ledger`** 폴더를 선택합니다.
   (이 저장소에는 다른 앱도 들어 있어서, 폴더를 지정해야 투자 장부가 배포됩니다.)
4. **Environment Variables** 에 아래 4개를 입력합니다.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SECRET_KEY` | Supabase Secret key (또는 service_role 키) |
| `ADMIN_USER` | 사이트 접속 아이디 (예: `admin`) |
| `ADMIN_PASSWORD` | 사이트 접속 비밀번호 (길고 어렵게) |

5. **Deploy** 클릭 → 1~2분 후 `https://…vercel.app` 주소가 생깁니다.
6. 주소로 접속하면 아이디/비밀번호 창이 뜹니다. 위에서 정한 `ADMIN_USER` / `ADMIN_PASSWORD` 를 입력하세요.

> 환경변수를 나중에 바꿨다면 Vercel → Deployments → 맨 위 배포의 **⋯ → Redeploy** 를 눌러야 적용됩니다.

### 3-3. (선택) 내 컴퓨터에서 실행

[Node.js](https://nodejs.org) 22 버전 이상을 설치한 뒤:

```bash
cd invest-ledger
cp .env.example .env.local   # 만든 .env.local 파일을 열어 값 입력
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. (내 컴퓨터에서는 `ADMIN_PASSWORD` 를 비워두면 비밀번호 없이 열립니다.)

`.env.local` 은 `.gitignore` 에 들어 있어서 GitHub 에 올라가지 않습니다.

---

## 4. 1단계 확인 방법 (체크리스트)

배포 후 아래를 차례로 확인해 주세요. 모두 되면 2단계로 넘어갑니다.

1. [ ] 사이트 주소 접속 시 아이디/비밀번호 창이 뜨고, 맞게 입력하면 대시보드가 보인다
2. [ ] **투자 등록**에서 금액을 입력하면 `100,000,000` 처럼 콤마가 자동으로 붙는다
3. [ ] 투자 실행일을 바꾸면 회수 시작일(다음 날)과 만기일이 자동으로 바뀐다
4. [ ] 회수기간 60일/100일/120일 버튼과 **직접 입력**이 동작한다
5. [ ] 오른쪽 “자동 계산”에 총 회수 예정금액이 보인다 (1억 · 20% → 120,000,000원)
6. [ ] 투자번호를 비워서 저장하면 `INV-2026-0001` 이 자동으로 붙는다
7. [ ] 저장 후 상세 화면으로 이동하고, **수정** 버튼으로 내용을 바꿀 수 있다
8. [ ] **취소 처리**하면 목록에서 사라지고, “취소 건 포함”을 누르면 다시 보인다 (삭제되지 않음)
9. [ ] 휴대폰으로 접속해도 화면이 깨지지 않고 상단 “메뉴” 버튼이 동작한다
10. [ ] Supabase → Table Editor → investments 에 저장한 데이터가 보인다

### 문제가 생기면

| 증상 | 해결 |
|---|---|
| “환경변수 설정이 필요합니다” | Vercel 환경변수 이름/값 확인 후 Redeploy |
| “ADMIN_PASSWORD 환경변수를 설정해야…” | Vercel 에 `ADMIN_PASSWORD` 추가 후 Redeploy |
| “relation … does not exist” / 표가 없다는 오류 | Supabase SQL Editor 에서 `0001_init.sql` 실행 |
| “permission denied” | Secret key 대신 공개키(anon/publishable)를 넣은 경우. `SUPABASE_SECRET_KEY` 값을 다시 확인 |
| “Invalid API key” | 키 앞뒤 공백 없이 다시 복사 |
| Vercel 빌드는 되는데 다른 앱이 보임 | Vercel → Settings → General → Root Directory 를 `invest-ledger` 로 |

---

## 5. 개발용 명령어

```bash
npm run dev        # 개발 서버
npm run build      # 배포용 빌드
npm run typecheck  # 타입 검사
npm run lint       # 코드 규칙 검사
npm test           # 계산 로직 테스트 (회수율 58.33% 예시 등)
```
