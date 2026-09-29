-- =====================================================================
-- 투자 실행·회수 장부  |  초기 스키마 (1~5단계 전체 구조)
-- Supabase → SQL Editor 에 이 파일 전체를 붙여넣고 [Run] 을 누르세요.
-- 여러 번 실행해도 안전합니다 (이미 있는 것은 건너뛰고, 빠진 것만 만듭니다).
--
--   customers (고객)
--      │ 1:N
--   investments (투자)
--      │ 1:N                        │ 1:N
--   repayment_schedules (회수계획) ──┤
--      │ 1:N (선택)                  │
--   repayments (실제 회수내역) ───────┘
--
--   profiles (사용자·권한)   audit_logs (변경 이력)
--
-- 원칙
--  * 금액은 원 단위 정수 numeric(15,0)
--  * 중요 데이터는 DELETE 금지 → status 컬럼으로 '취소/무효' 처리 (트리거로 강제)
--  * 모든 수정은 audit_logs 에 자동 기록
--  * 합계·회수율·연체는 뷰(v_*)에서 계산 → 화면과 엑셀 내보내기가 같은 숫자를 사용
-- =====================================================================

-- ---------------------------------------------------------------------
-- 공통 함수
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.prevent_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '[%] 데이터는 삭제할 수 없습니다. 상태를 변경(취소/무효)하세요.', tg_table_name;
end $$;

-- 한국 시간 기준 오늘 날짜
create or replace function public.today_kst()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- ---------------------------------------------------------------------
-- 사용자·권한 (5단계에서 로그인과 연결. 지금은 구조만 준비)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete restrict,
  display_name text not null default '',
  role         text not null default 'staff' check (role in ('admin', 'staff', 'viewer')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is '사용자. role: admin(관리자) / staff(직원) / viewer(조회 전용)';

-- ---------------------------------------------------------------------
-- 고객
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  phone      text not null default '',
  memo       text not null default '',
  status     text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.customers is '고객 정보. 삭제 대신 status=inactive';
create index if not exists customers_name_idx on public.customers (name);
create index if not exists customers_phone_idx on public.customers (phone);

-- ---------------------------------------------------------------------
-- 투자
-- ---------------------------------------------------------------------
create sequence if not exists public.investment_no_seq;

create table if not exists public.investments (
  id                uuid primary key default gen_random_uuid(),
  investment_no     text not null unique
                    default ('INV-' || lpad(nextval('public.investment_no_seq')::text, 5, '0')),
  customer_id       uuid not null references public.customers (id) on delete restrict,
  target_name       text not null check (length(btrim(target_name)) > 0),
  executed_on       date not null,
  principal         numeric(15, 0) not null check (principal > 0),
  return_rate       numeric(7, 3) not null default 0 check (return_rate >= 0 and return_rate < 1000),
  expected_total    numeric(15, 0) generated always as (round(principal * (1 + return_rate / 100))) stored,
  repayment_method  text not null default 'daily'
                    check (repayment_method in ('daily', 'every7', 'every10', 'monthly', 'bullet')),
  period_days       integer not null default 100 check (period_days between 1 and 3650),
  start_on          date not null,
  maturity_on       date not null,
  status            text not null default 'active'
                    check (status in ('active', 'completed', 'suspended', 'cancelled')),
  status_reason     text not null default '',
  memo              text not null default '',
  created_by        uuid references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (maturity_on >= start_on)
);
comment on table public.investments is '투자 건. status: active(진행중) completed(완료) suspended(보류) cancelled(취소=삭제 대신)';
comment on column public.investments.expected_total is '총 회수 예정금액 = 투자금액 × (1 + 수익률/100) (자동 계산)';
create index if not exists investments_customer_idx on public.investments (customer_id);
create index if not exists investments_executed_idx on public.investments (executed_on);
create index if not exists investments_maturity_idx on public.investments (maturity_on);
create index if not exists investments_status_idx on public.investments (status);

-- ---------------------------------------------------------------------
-- 회수계획 (2단계에서 자동 생성)
-- ---------------------------------------------------------------------
create table if not exists public.repayment_schedules (
  id             uuid primary key default gen_random_uuid(),
  investment_id  uuid not null references public.investments (id) on delete restrict,
  seq            integer not null check (seq > 0),
  due_date       date not null,
  planned_amount numeric(15, 0) not null check (planned_amount >= 0),
  memo           text not null default '',
  status         text not null default 'active' check (status in ('active', 'void')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, investment_id)
);
comment on table public.repayment_schedules is '회차별 회수 예정. 미회수여도 지우지 않음. 계획을 다시 만들면 기존 행은 status=void';
create unique index if not exists repayment_schedules_seq_uq
  on public.repayment_schedules (investment_id, seq) where status = 'active';
create index if not exists repayment_schedules_due_idx on public.repayment_schedules (due_date) where status = 'active';

-- ---------------------------------------------------------------------
-- 실제 회수내역 (입금 기록)
-- ---------------------------------------------------------------------
create table if not exists public.repayments (
  id            uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments (id) on delete restrict,
  schedule_id   uuid,
  paid_on       date not null,
  amount        numeric(15, 0) not null check (amount > 0),
  memo          text not null default '',
  status        text not null default 'valid' check (status in ('valid', 'void')),
  void_reason   text not null default '',
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 회차를 지정했다면 반드시 같은 투자 건의 회차여야 함
  foreign key (schedule_id, investment_id)
    references public.repayment_schedules (id, investment_id) on delete restrict
);
comment on table public.repayments is '실제 입금 기록. 잘못 입력하면 삭제 대신 status=void';
create index if not exists repayments_investment_idx on public.repayments (investment_id) where status = 'valid';
create index if not exists repayments_schedule_idx on public.repayments (schedule_id) where status = 'valid';
create index if not exists repayments_paid_on_idx on public.repayments (paid_on) where status = 'valid';

-- ---------------------------------------------------------------------
-- 변경 이력 (누가 언제 무엇을 바꿨는지)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb,
  actor      uuid,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_row_idx on public.audit_logs (row_id);

create or replace function public.write_audit_log()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.audit_logs (table_name, row_id, action, old_data, new_data, actor)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new),
    auth.uid()
  );
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 트리거: updated_at / 삭제 금지 / 변경 이력
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'customers', 'investments', 'repayment_schedules', 'repayments'] loop
    execute format('create or replace trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('create or replace trigger %I before delete on public.%I for each row execute function public.prevent_delete()', t || '_no_delete', t);
  end loop;
  foreach t in array array['customers', 'investments', 'repayment_schedules', 'repayments'] loop
    execute format('create or replace trigger %I after insert or update on public.%I for each row execute function public.write_audit_log()', t || '_audit', t);
  end loop;
end $$;

create or replace trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.prevent_delete();
create or replace trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.prevent_delete();

-- ---------------------------------------------------------------------
-- 계산용 뷰 (화면·통계·엑셀이 같이 사용)
-- ---------------------------------------------------------------------

-- 회차별 상태: 실제 회수금액·미회수금액·연체 여부
create or replace view public.v_schedule_status with (security_invoker = true) as
select
  s.id,
  s.investment_id,
  s.seq,
  s.due_date,
  s.planned_amount,
  s.memo,
  coalesce(p.paid_amount, 0)                                  as paid_amount,
  p.last_paid_on,
  greatest(s.planned_amount - coalesce(p.paid_amount, 0), 0) as unpaid_amount,
  case
    when coalesce(p.paid_amount, 0) >= s.planned_amount then 'paid'
    when s.due_date < public.today_kst() then 'overdue'
    when coalesce(p.paid_amount, 0) > 0 then 'partial'
    when s.due_date = public.today_kst() then 'due_today'
    else 'scheduled'
  end                                                         as state,
  (s.due_date < public.today_kst()
     and coalesce(p.paid_amount, 0) < s.planned_amount)      as is_overdue
from public.repayment_schedules s
left join lateral (
  select sum(r.amount) as paid_amount, max(r.paid_on) as last_paid_on
  from public.repayments r
  where r.schedule_id = s.id and r.status = 'valid'
) p on true
where s.status = 'active';

-- 투자 건별 요약: 회수금액·남은금액·회수율·연체·경과일수
create or replace view public.v_investment_summary with (security_invoker = true) as
select
  i.*,
  c.name                                          as customer_name,
  c.phone                                         as customer_phone,
  coalesce(r.collected, 0)                        as collected_amount,
  greatest(i.expected_total - coalesce(r.collected, 0), 0) as remaining_amount,
  case when i.expected_total > 0
       then round(coalesce(r.collected, 0) * 100.0 / i.expected_total, 2)
       else 0 end                                 as recovery_rate,
  coalesce(o.overdue_amount, 0)                   as overdue_amount,
  coalesce(o.overdue_count, 0)                    as overdue_count,
  coalesce(o.schedule_count, 0)                   as schedule_count,
  r.last_paid_on,
  greatest(public.today_kst() - i.start_on + 1, 0) as elapsed_days,
  greatest(i.maturity_on - public.today_kst(), 0)  as remaining_days
from public.investments i
join public.customers c on c.id = i.customer_id
left join lateral (
  select sum(x.amount) as collected, max(x.paid_on) as last_paid_on
  from public.repayments x
  where x.investment_id = i.id and x.status = 'valid'
) r on true
left join lateral (
  select
    count(*)                                                    as schedule_count,
    sum(v.unpaid_amount) filter (where v.is_overdue)            as overdue_amount,
    count(*) filter (where v.is_overdue)                        as overdue_count
  from public.v_schedule_status v
  where v.investment_id = i.id
) o on true;

-- ---------------------------------------------------------------------
-- 보안: RLS 켜기 + 브라우저용 키(anon/authenticated)로는 접근 불가
--       앱은 서버에서만 service_role 키로 접근합니다. (5단계에서 로그인 정책 추가)
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.customers           enable row level security;
alter table public.investments         enable row level security;
alter table public.repayment_schedules enable row level security;
alter table public.repayments          enable row level security;
alter table public.audit_logs          enable row level security;

revoke all on public.profiles, public.customers, public.investments, public.repayment_schedules,
              public.repayments, public.audit_logs, public.v_schedule_status, public.v_investment_summary
  from anon, authenticated;
grant all on public.profiles, public.customers, public.investments, public.repayment_schedules,
             public.repayments, public.audit_logs, public.v_schedule_status, public.v_investment_summary
  to service_role;
grant usage, select on sequence public.investment_no_seq to service_role;
