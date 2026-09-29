# 투자 회수 장부 (invest-ledger)

투자 실행과 회수를 관리하는 웹 장부입니다. PC와 휴대폰에서 모두 쓸 수 있습니다.

- 기술: Next.js 16 (TypeScript) · Supabase (PostgreSQL) · Vercel 배포
- 전체 구조와 DB 설계: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 개발 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 기본 화면 + 데이터베이스 + 투자 등록/수정/상태변경 + 투자 목록 | ✅ 완료 |
| 2 | 회수계획 자동 생성 + 실제 회수 입력(미회수·연체 기록) | 예정 |
| 3 | 대시보드(오늘/내일/7일/연체, 만기 알림 색상) + 월별 통계·그래프 + 전체 현황 | 예정 |
| 4 | 검색·필터·정렬 + 고객별 관리 | 예정 |
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
│  ├─ page.tsx                       홈 (요약)
│  ├─ error.tsx / not-found.tsx      오류 안내 화면
│  └─ investments/
│     ├─ page.tsx                    투자 목록
│     ├─ actions.ts                  저장·수정·상태변경 (서버)
│     ├─ new/page.tsx                투자 등록
│     └─ [id]/page.tsx, edit/page.tsx  상세 / 수정
├─ components/                       화면 조각
│  ├─ AppShell.tsx                   네이비 메뉴 (PC 왼쪽 / 휴대폰 위쪽)
│  ├─ InvestmentForm.tsx             투자 입력폼 (자동 계산)
│  ├─ StatusChangeForm.tsx           상태 변경
│  └─ StatCard.tsx, StatusBadge.tsx, PageHeader.tsx, SubmitButton.tsx
├─ lib/
│  ├─ calc.ts                        회수 예정금액·만기일·회수율 계산
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
