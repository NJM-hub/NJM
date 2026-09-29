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

## 처음 설치하기 (약 20분)

> 코드를 직접 고칠 필요는 없습니다. 아래 순서대로 **웹사이트에서 클릭과 복사/붙여넣기**만 하면 됩니다.

### 1단계. Supabase(데이터베이스) 만들기

1. <https://supabase.com> 에 가입 → **New project**
   - Name: `invest-ledger` (아무거나)
   - Database Password: 안전한 비밀번호 (따로 적어두세요)
   - Region: **Northeast Asia (Seoul)**
2. 프로젝트가 만들어지면(1~2분) 왼쪽 메뉴 **SQL Editor** → **New query**
3. 이 저장소의 `invest-ledger/supabase/migrations/0001_init.sql` 파일 내용을 **전체 복사**해서 붙여넣고 **Run** 을 누릅니다.
   - `Success. No rows returned` 가 나오면 성공입니다.
   - ⚠️ 이 SQL은 **한 번만** 실행합니다. 두 번 실행하면 "already exists" 오류가 나는데, 이미 만들어졌다는 뜻이니 무시해도 됩니다.
4. 왼쪽 **Table Editor** 에 `customers`, `investments`, `repayment_schedules`, `repayments` 등이 보이면 완료.
5. **Project Settings → API Keys** (또는 **Data API**) 화면에서 두 값을 복사해 둡니다.
   - **Project URL** (예: `https://abcdxyz.supabase.co`)
   - **service_role** 키 (새 화면에서는 **Secret keys** 의 `sb_secret_...` 키) — "Reveal"을 눌러 복사

> 🔒 service_role(secret) 키는 **은행 공인인증서 같은 것**입니다. 이 키가 있으면 DB 전체를 읽고 쓸 수 있으니
> 카톡·메일·GitHub 등에 절대 붙여넣지 말고, Vercel 환경변수에만 넣으세요.

### 2단계. Vercel(웹사이트) 배포

1. <https://vercel.com> 에 GitHub 계정으로 로그인 → **Add New… → Project**
2. 이 GitHub 저장소를 **Import**
3. ⭐ **Root Directory** 옆 **Edit** → `invest-ledger` 폴더를 선택 (이 저장소에는 다른 앱도 들어 있어서 꼭 지정해야 합니다)
4. Framework Preset 이 **Next.js** 로 잡혔는지 확인
5. **Environment Variables** 에 아래 4개를 추가

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role(secret) 키 |
| `BASIC_AUTH_USER` | 접속 아이디 (예: `admin`) |
| `BASIC_AUTH_PASSWORD` | 접속 비밀번호 (영문+숫자로 길게) |

6. **Deploy** → 1~2분 후 나오는 주소(예: `https://invest-ledger-xxx.vercel.app`)로 접속
7. 브라우저가 아이디/비밀번호를 물으면 위에서 정한 `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` 입력

> 환경변수를 나중에 바꿨다면 Vercel → **Deployments** → 최신 배포의 `⋯` → **Redeploy** 를 눌러야 적용됩니다.

### (참고) 접속 비밀번호에 대해
5단계에서 정식 로그인 화면을 만들기 전까지, 사이트 전체를 **간단한 아이디/비밀번호**로 보호합니다.
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
├─ proxy.ts                          접속 비밀번호 확인
└─ docs/ARCHITECTURE.md              구조·DB 설계 설명
```

## 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| "화면을 불러오지 못했습니다" | Vercel 환경변수 2개(Supabase URL, service_role 키) 확인 → Redeploy |
| "relation ... does not exist" / "Could not find the table" | Supabase SQL Editor 에서 `0001_init.sql` 실행 |
| "BASIC_AUTH_PASSWORD 환경변수를 설정해야…" | Vercel 환경변수에 `BASIC_AUTH_PASSWORD` 추가 → Redeploy |
| 비밀번호를 맞게 넣어도 계속 물어봄 | 비밀번호에 한글이 있으면 안 됩니다. 영문·숫자로 바꾸세요 |
| Vercel 빌드가 다른 앱으로 됨 | Vercel → Settings → General → **Root Directory** 가 `invest-ledger` 인지 확인 |
