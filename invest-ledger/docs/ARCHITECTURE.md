# 시스템 구조와 데이터베이스 설계

## 1. 전체 구조

```
[PC·휴대폰 브라우저]
        │  (접속 비밀번호 확인 — proxy.ts)
        ▼
[Vercel]  Next.js 앱 (화면 + 서버)
   ├─ app/          화면(페이지)
   ├─ components/   화면 조각(버튼, 카드, 입력폼)
   ├─ lib/          계산·검증·DB 조회 로직
   └─ app/**/actions.ts  저장/수정 처리 (서버에서만 실행)
        │  service_role 키 (서버에만 존재, 브라우저로 절대 안 나감)
        ▼
[Supabase]  PostgreSQL 데이터베이스
   ├─ 테이블: customers / investments / repayment_schedules / repayments / profiles / audit_logs
   └─ 뷰:    v_schedule_status / v_investment_summary  (자동 계산)
```

- **브라우저는 DB에 직접 접근하지 않습니다.** 모든 조회·저장은 Vercel 서버를 거칩니다.
- DB는 RLS(행 단위 보안)가 켜져 있고 공개 키로는 아무것도 읽을 수 없습니다.
- 5단계에서 Supabase 로그인을 붙이면 `proxy.ts` 의 임시 비밀번호를 로그인 화면으로 바꿉니다.

## 2. 테이블 관계

```
customers (고객) 1 ──── N investments (투자)
                              │ 1
                              ├──── N repayment_schedules (회수계획: 회차별 예정일·예정금액)
                              │              │ 1
                              │              └──── N repayments (실제 회수내역)
                              └──────────────────── N repayments   (회차 없이 받은 입금도 기록 가능)

auth.users (Supabase 로그인) 1 ── 1 profiles (이름·권한)
모든 변경 ──▶ audit_logs (변경 이력)
```

### customers — 고객
| 컬럼 | 설명 |
|---|---|
| id | 고유번호 (자동) |
| name | 고객명 |
| phone | 연락처 |
| memo | 메모 |
| status | `active` 사용 / `inactive` 미사용 (삭제 대신) |

### investments — 투자
| 컬럼 | 설명 |
|---|---|
| investment_no | 투자번호 (비우면 `INV-00001` 형식 자동) |
| customer_id | 고객 → customers.id |
| target_name | 투자 대상명 |
| executed_on | 투자 실행일 |
| principal | 투자 실행금액 (원) |
| return_rate | 수익률 (%) |
| expected_total | **총 회수 예정금액 (자동)** = 투자금액 × (1 + 수익률/100) |
| repayment_method | `daily` 일일 / `every7` 7일 / `every10` 10일 / `monthly` 월 / `bullet` 만기 일시 |
| period_days | 회수기간 (기본 100일) |
| start_on / maturity_on | 회수 시작일 / 만기일 |
| status | `active` 진행중 / `completed` 완료 / `suspended` 보류 / `cancelled` 취소 |
| status_reason | 상태 변경 사유 |
| memo | 메모 |

### repayment_schedules — 회수계획 (2단계)
| 컬럼 | 설명 |
|---|---|
| investment_id | 투자 → investments.id |
| seq | 회차 (1, 2, 3 …) |
| due_date | 예정 회수일 |
| planned_amount | 예정 회수금액 |
| memo | 메모 |
| status | `active` / `void` (계획을 다시 만들 때 기존 회차는 삭제하지 않고 void) |

### repayments — 실제 회수내역 (2단계)
| 컬럼 | 설명 |
|---|---|
| investment_id | 투자 → investments.id |
| schedule_id | 회차 → repayment_schedules.id (선택. 같은 투자 건의 회차만 연결 가능) |
| paid_on | 실제 회수일 |
| amount | 실제 회수금액 |
| status | `valid` / `void` (잘못 입력하면 삭제 대신 void) |

### profiles — 사용자·권한 (5단계)
`role`: `admin` 관리자 / `staff` 직원 / `viewer` 조회 전용

### audit_logs — 변경 이력
누가(actor) 언제 어떤 표의 어떤 행을 어떻게 바꿨는지 변경 전/후 값을 통째로 저장. 수정·삭제 불가.

## 3. 자동 계산 (뷰)

**v_schedule_status** (회차별)
- `paid_amount` 실제 회수금액 = 그 회차에 연결된 유효 입금 합계
- `unpaid_amount` 미회수금액 = 예정금액 − 실제 회수금액
- `state` = `paid` 완납 / `overdue` 연체 / `partial` 일부 입금 / `due_today` 오늘 예정 / `scheduled` 예정
- `is_overdue` = 예정일이 지났는데 다 못 받은 경우

**v_investment_summary** (투자 건별)
- `collected_amount` 현재까지 회수금액
- `remaining_amount` 남은 회수금액 = 총 회수 예정금액 − 회수금액
- `recovery_rate` 회수율(%) = 회수금액 ÷ 총 회수 예정금액 × 100
- `overdue_amount` / `overdue_count` 연체금액 / 연체 회차 수
- `elapsed_days` 경과일수, `remaining_days` 남은 회수기간

> 예) 투자 100,000,000원 · 수익률 20% → 총 회수 예정 120,000,000원.
> 70,000,000원 회수 시 남은 금액 50,000,000원, 회수율 58.33%.

## 4. 데이터 삭제 사고 방지
- customers / investments / repayment_schedules / repayments / profiles 는 **DELETE 가 DB 트리거로 차단**됩니다.
- 대신 `status` 를 바꿉니다 (취소·미사용·무효). 화면에서도 삭제 버튼 없이 "상태 변경"만 제공합니다.
- 모든 등록·수정은 `audit_logs` 에 자동 기록됩니다.

## 5. 향후 확장
- **직원 계정(5단계)**: `profiles.role` 로 권한 구분, 테이블에 로그인 사용자용 RLS 정책 추가, `created_by` 에 작성자 기록.
- **엑셀 내보내기**: 두 뷰(v_investment_summary, v_schedule_status)가 화면과 같은 숫자를 한 줄씩 제공하므로 그대로 엑셀 행으로 내보내면 됩니다.
