-- =====================================================================
-- 투자 장부 (invest-ledger) 초기 데이터베이스 구조
--
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를
--         붙여넣고 [Run] 을 누르면 됩니다. (한 번만 실행)
--
-- 테이블 관계
--   customers (고객)            1 ── N  investments (투자)
--   investments (투자)          1 ── N  repayment_schedules (회수계획)
--   investments (투자)          1 ── N  repayments (실제 회수내역)
--   repayment_schedules (계획)  1 ── N  repayments (어느 회차에 대한 입금인지, 선택)
--   auth.users (로그인 계정)    1 ── 1  profiles (사용자 권한, 5단계에서 사용)
--
-- 삭제 방지 원칙
--   고객·투자·회수계획·회수내역은 DELETE 가 DB 에서 막혀 있습니다.
--   대신 status(상태) 값을 바꿔서 "취소/비활성/무효" 처리합니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 공통 함수
-- ---------------------------------------------------------------------

-- 한국 날짜 기준 "오늘" (DB 서버 시간은 UTC 이므로 변환)
create or replace function public.kst_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- 수정할 때마다 updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- 삭제 금지 (실수로 지우는 사고 방지)
create or replace function public.prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '데이터 보호: % 테이블의 데이터는 삭제할 수 없습니다. 상태(status)를 변경하세요.', tg_table_name;
end
$$;

-- ---------------------------------------------------------------------
-- 사용자 권한 (5단계 로그인에서 사용. 지금은 비어 있어도 됨)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'staff' check (role in ('admin', 'staff', 'viewer')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is '로그인 사용자 권한 (admin=관리자, staff=직원, viewer=조회전용)';

-- ---------------------------------------------------------------------
-- 고객정보
-- ---------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  phone       text,
  memo        text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.customers is '고객정보. status: active=사용, inactive=비활성(삭제 대신)';
create index customers_name_idx on public.customers (name);
create index customers_phone_idx on public.customers (phone);

-- ---------------------------------------------------------------------
-- 투자정보
-- ---------------------------------------------------------------------
create sequence public.investment_no_seq;

create table public.investments (
  id                uuid primary key default gen_random_uuid(),
  investment_no     text not null unique,
  customer_id       uuid not null references public.customers (id) on delete restrict,
  target_name       text not null check (length(btrim(target_name)) > 0),
  executed_on       date not null,
  principal         bigint not null check (principal > 0),
  return_rate       numeric(7, 3) not null default 0 check (return_rate >= 0 and return_rate <= 1000),
  -- 총 회수 예정금액 = 투자금액 × (1 + 수익률%) : DB 가 자동 계산
  expected_total    bigint generated always as (round(principal * (1 + return_rate / 100))::bigint) stored,
  repayment_method  text not null check (repayment_method in ('daily', 'every7', 'every10', 'monthly', 'bullet')),
  term_days         integer not null default 100 check (term_days between 1 and 3650),
  start_on          date not null,
  maturity_on       date not null,
  memo              text,
  status            text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  status_changed_at timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint investments_dates_chk check (start_on >= executed_on and maturity_on >= start_on)
);
comment on table public.investments is '투자정보. status: active=진행중, completed=완료, cancelled=취소(삭제 대신)';
comment on column public.investments.repayment_method is 'daily=일일, every7=7일 단위, every10=10일 단위, monthly=월 단위, bullet=만기 일시상환';
create index investments_customer_idx on public.investments (customer_id);
create index investments_executed_idx on public.investments (executed_on);
create index investments_maturity_idx on public.investments (maturity_on);
create index investments_status_idx on public.investments (status);

-- 투자번호를 비워두면 INV-2026-0001 형식으로 자동 부여
create or replace function public.assign_investment_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.investment_no is null or btrim(new.investment_no) = '' then
    new.investment_no := 'INV-' || to_char(new.executed_on, 'YYYY') || '-'
      || lpad(nextval('public.investment_no_seq')::text, 4, '0');
  else
    new.investment_no := btrim(new.investment_no);
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 회수계획 (회차별 예정일·예정금액)  ※ 2단계에서 화면 연결
-- ---------------------------------------------------------------------
create table public.repayment_schedules (
  id               uuid primary key default gen_random_uuid(),
  investment_id    uuid not null references public.investments (id) on delete restrict,
  seq              integer not null check (seq > 0),
  due_on           date not null,
  expected_amount  bigint not null check (expected_amount >= 0),
  memo             text,
  status           text not null default 'active' check (status in ('active', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (investment_id, seq),
  unique (id, investment_id)
);
comment on table public.repayment_schedules is '회수계획. 받지 못해도 지우지 않고 남겨두며, 미회수/연체는 실제 회수내역과 비교해 자동 판정. status=cancelled 는 계획 변경으로 무효가 된 회차';
create index repayment_schedules_due_idx on public.repayment_schedules (due_on);

-- ---------------------------------------------------------------------
-- 실제 회수내역 (실제 입금 기록)  ※ 2단계에서 화면 연결
-- ---------------------------------------------------------------------
create table public.repayments (
  id             uuid primary key default gen_random_uuid(),
  investment_id  uuid not null references public.investments (id) on delete restrict,
  schedule_id    uuid,
  paid_on        date not null,
  amount         bigint not null check (amount > 0),
  memo           text,
  status         text not null default 'valid' check (status in ('valid', 'void')),
  void_reason    text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 회차를 지정하면 반드시 같은 투자 건의 회차여야 함
  constraint repayments_schedule_fk foreign key (schedule_id, investment_id)
    references public.repayment_schedules (id, investment_id) on delete restrict
);
comment on table public.repayments is '실제 회수내역. 잘못 입력한 경우 삭제하지 않고 status=void(무효) 처리';
create index repayments_investment_idx on public.repayments (investment_id);
create index repayments_schedule_idx on public.repayments (schedule_id);
create index repayments_paid_on_idx on public.repayments (paid_on);

-- ---------------------------------------------------------------------
-- 트리거
-- ---------------------------------------------------------------------
create trigger investments_assign_no before insert on public.investments
  for each row execute function public.assign_investment_no();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger investments_updated_at before update on public.investments
  for each row execute function public.set_updated_at();
create trigger repayment_schedules_updated_at before update on public.repayment_schedules
  for each row execute function public.set_updated_at();
create trigger repayments_updated_at before update on public.repayments
  for each row execute function public.set_updated_at();

create trigger customers_no_delete before delete on public.customers
  for each row execute function public.prevent_delete();
create trigger investments_no_delete before delete on public.investments
  for each row execute function public.prevent_delete();
create trigger repayment_schedules_no_delete before delete on public.repayment_schedules
  for each row execute function public.prevent_delete();
create trigger repayments_no_delete before delete on public.repayments
  for each row execute function public.prevent_delete();

-- ---------------------------------------------------------------------
-- 조회용 뷰 (자동 계산 결과). 엑셀 내보내기도 이 뷰를 그대로 사용
-- ---------------------------------------------------------------------

-- 회차별 상태: 예정 / 오늘 / 연체 / 일부회수 / 완납 / 무효
create view public.schedule_status
with (security_invoker = true)
as
select
  s.id,
  s.investment_id,
  s.seq,
  s.due_on,
  s.expected_amount,
  s.memo,
  s.status,
  coalesce(p.paid_amount, 0)                                   as paid_amount,
  greatest(s.expected_amount - coalesce(p.paid_amount, 0), 0)  as unpaid_amount,
  p.last_paid_on,
  case
    when s.status = 'cancelled'                               then 'cancelled'
    when coalesce(p.paid_amount, 0) >= s.expected_amount      then 'paid'
    when s.due_on < public.kst_today()                        then 'overdue'
    when s.due_on = public.kst_today()                        then 'due_today'
    when coalesce(p.paid_amount, 0) > 0                       then 'partial'
    else 'scheduled'
  end                                                          as state
from public.repayment_schedules s
left join lateral (
  select sum(r.amount)::bigint as paid_amount, max(r.paid_on) as last_paid_on
  from public.repayments r
  where r.schedule_id = s.id and r.status = 'valid'
) p on true;

-- 투자 건별 요약: 회수금액·남은금액·회수율·경과일·남은일수·연체금액
-- 연체금액 = (어제까지 받기로 한 금액 합계) - (지금까지 실제 받은 금액), 0 미만이면 0
create view public.investment_summary
with (security_invoker = true)
as
select
  i.id,
  i.investment_no,
  i.customer_id,
  c.name                                                        as customer_name,
  c.phone                                                       as customer_phone,
  i.target_name,
  i.executed_on,
  i.principal,
  i.return_rate,
  i.expected_total,
  i.repayment_method,
  i.term_days,
  i.start_on,
  i.maturity_on,
  i.memo,
  i.status,
  i.created_at,
  i.updated_at,
  coalesce(r.paid_total, 0)                                     as paid_total,
  greatest(i.expected_total - coalesce(r.paid_total, 0), 0)     as remaining_amount,
  case when i.expected_total > 0
       then round(coalesce(r.paid_total, 0)::numeric * 100 / i.expected_total, 2)
       else 0 end                                               as recovery_rate,
  greatest(public.kst_today() - i.executed_on, 0)               as elapsed_days,
  greatest(i.maturity_on - public.kst_today(), 0)               as remaining_days,
  i.maturity_on - public.kst_today()                            as days_to_maturity,
  r.last_paid_on,
  coalesce(s.due_until_yesterday, 0)                            as due_until_yesterday,
  case when i.status = 'active'
       then greatest(coalesce(s.due_until_yesterday, 0) - coalesce(r.paid_total, 0), 0)
       else 0 end                                               as overdue_amount,
  coalesce(s.schedule_count, 0)                                 as schedule_count
from public.investments i
join public.customers c on c.id = i.customer_id
left join lateral (
  select sum(x.amount)::bigint as paid_total, max(x.paid_on) as last_paid_on
  from public.repayments x
  where x.investment_id = i.id and x.status = 'valid'
) r on true
left join lateral (
  select
    sum(y.expected_amount) filter (where y.due_on < public.kst_today())::bigint as due_until_yesterday,
    count(*)::int as schedule_count
  from public.repayment_schedules y
  where y.investment_id = i.id and y.status = 'active'
) s on true;

-- ---------------------------------------------------------------------
-- 보안: RLS(행 단위 보안) 켜기
--   지금(1~4단계)은 서버에서만 비밀키(secret key)로 접근하므로 정책 없이 전부 차단.
--   5단계(로그인)에서 로그인한 직원용 정책을 추가합니다.
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.customers           enable row level security;
alter table public.investments         enable row level security;
alter table public.repayment_schedules enable row level security;
alter table public.repayments          enable row level security;

-- 서버(비밀키)가 테이블에 접근할 수 있도록 권한 부여 (DELETE 는 주지 않음)
grant usage on schema public to service_role;
grant select, insert, update on public.profiles, public.customers, public.investments,
  public.repayment_schedules, public.repayments to service_role;
grant select on public.schedule_status, public.investment_summary to service_role;
grant usage, select on sequence public.investment_no_seq to service_role;

-- 브라우저용 공개키(anon)로는 아무것도 못 보게 함
revoke all on public.profiles, public.customers, public.investments,
  public.repayment_schedules, public.repayments,
  public.schedule_status, public.investment_summary from anon;
