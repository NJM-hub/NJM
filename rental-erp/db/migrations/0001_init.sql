-- 임대업 종합관리(ERP) 데이터베이스
-- 구조: 소유주(개인/법인) → 부동산 → 호실 → 계약(임차인) → 월 청구 → 입금(배분)
--       부동산 → 대출 → 대출거래(원금상환·이자납부·금리변경)
--       부동산 → 비용 / 문서,  계약 → 보증금,  알림 → 발송기록(문자·카카오·이메일 연동 대비)
-- 금액은 모두 원 단위 bigint, 금리는 연 % (numeric).

create extension if not exists pgcrypto;

-- 사용자 / 권한 ------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null default 'viewer' check (role in ('admin', 'staff', 'viewer')),
  password_hash text not null,
  is_active boolean not null default true,
  session_version int not null default 1,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- 소유주 (개인 / 법인) --------------------------------------------------------
create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_type text not null default 'individual' check (owner_type in ('individual', 'corporation')),
  biz_no text,            -- 사업자등록번호 (법인등록번호)
  representative text,    -- 대표자
  phone text,
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 부동산 -------------------------------------------------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references owners(id) on delete set null,
  name text not null,
  address text,
  building_name text,
  property_type text not null default 'commercial'
    check (property_type in ('commercial', 'office', 'house', 'apartment', 'officetel', 'factory', 'land', 'etc')),
  purchase_date date,
  purchase_price bigint not null default 0,
  current_value bigint,
  acquisition_cost bigint not null default 0,   -- 취득세·중개·법무 등
  remodeling_cost bigint not null default 0,
  other_investment bigint not null default 0,
  memo text,
  is_active boolean not null default true,      -- 매각/정리 시 false
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on properties(owner_id);

-- 호실 (부동산 1개에 여러 호실) ----------------------------------------------
create table units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  dong text,                 -- 동
  floor text,                -- 층
  unit_no text not null,     -- 호실 (예: 302호, 전체)
  area_m2 numeric(10,2),
  expected_deposit bigint not null default 0,   -- 공실일 때 예상 보증금
  expected_rent bigint not null default 0,      -- 공실일 때 예상 월세 (공실손실 계산)
  vacant_since date,                            -- 공실 시작일 (비우면 마지막 계약 종료 다음날)
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on units(property_id);

-- 임차인 -------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  biz_no text,
  email text,
  memo text,
  created_at timestamptz not null default now()
);
create index on tenants(name);

-- 임대차 계약 --------------------------------------------------------------
-- status: planned(계약 예정) / active(정상) / expired(만료) / renewed(갱신되어 종료) / terminated(중도해지)
-- '만료 예정' 은 active 이면서 종료일이 가까운 것을 화면에서 계산한다.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  contract_no text not null unique,
  unit_id uuid not null references units(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  landlord_name text,
  contract_date date,
  start_date date not null,
  end_date date not null,
  deposit bigint not null default 0,
  monthly_rent bigint not null default 0,
  maintenance_fee bigint not null default 0,
  vat_amount bigint not null default 0,         -- 월 부가세 (상가 등)
  pay_day int not null default 25 check (pay_day between 1 and 31),
  billing_from date,                            -- 월세 자동 청구 시작 월 (비우면 시작일이 속한 달)
  status text not null default 'active' check (status in ('planned', 'active', 'expired', 'renewed', 'terminated')),
  is_renewal boolean not null default false,    -- 갱신 계약 여부
  previous_contract_id uuid references contracts(id) on delete set null,
  terminated_on date,                           -- 중도해지일
  special_terms text,                           -- 특약사항
  ocr_extracted jsonb,                          -- AI 가 추출한 원본 값 (검토 기록)
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on contracts(unit_id);
create index on contracts(tenant_id);

-- 보증금 (계약 1건에 1행) ---------------------------------------------------
create table deposits (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references contracts(id) on delete cascade,
  amount bigint not null default 0,             -- 약정 보증금
  received_amount bigint not null default 0,    -- 실제 받은 보증금
  received_date date,
  return_due_date date,                         -- 반환 예정일 (기본: 계약 종료일)
  returned_amount bigint not null default 0,    -- 반환한 금액 (일부 반환 포함)
  offset_amount bigint not null default 0,      -- 상계 금액 (미납 월세·원상복구비 등)
  returned_date date,
  status text not null default 'held' check (status in ('held', 'partial', 'returned')),
  memo text
);

-- 월세 청구 (매월 자동 생성) -----------------------------------------------
create table rent_charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  billing_month date not null,                  -- 청구 월 (매월 1일로 저장)
  due_date date not null,                       -- 납부일
  rent_amount bigint not null default 0,
  maintenance_amount bigint not null default 0,
  vat_amount bigint not null default 0,
  amount bigint not null,                       -- 청구 합계
  paid_amount bigint not null default 0,        -- 배분된 입금 합계 (자동 계산)
  memo text,
  created_at timestamptz not null default now(),
  unique (contract_id, billing_month)
);
create index on rent_charges(due_date);

-- 입금 --------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  charge_id uuid references rent_charges(id) on delete set null,  -- 지정 청구월 (없으면 오래된 미납부터)
  paid_date date not null,
  amount bigint not null check (amount > 0),
  method text not null default 'transfer' check (method in ('transfer', 'cash', 'card', 'cms', 'offset', 'etc')),
  memo text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on payments(contract_id);
create index on payments(paid_date);

-- 입금 → 청구 배분 (자동 계산 결과) ------------------------------------------
create table payment_allocations (
  payment_id uuid not null references payments(id) on delete cascade,
  charge_id uuid not null references rent_charges(id) on delete cascade,
  amount bigint not null,
  primary key (payment_id, charge_id)
);

-- 대출 --------------------------------------------------------------------
create table loans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  lender text not null,                         -- 금융기관
  product text,                                 -- 대출상품
  start_date date,
  principal bigint not null default 0,          -- 대출원금
  balance bigint not null default 0,            -- 현재 잔액 (원금상환 시 자동 감소)
  interest_rate numeric(6,3) not null default 0,
  rate_type text not null default 'variable' check (rate_type in ('fixed', 'variable')),
  repayment_type text not null default 'bullet'
    check (repayment_type in ('bullet', 'equal_payment', 'equal_principal', 'grace')),
  monthly_payment bigint,                       -- 월 상환금 (원금+이자, 비우면 자동)
  interest_day int check (interest_day between 1 and 31),
  maturity_date date,
  memo text,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on loans(property_id);

create table loan_transactions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  tx_date date not null,
  tx_type text not null check (tx_type in ('principal', 'interest', 'rate_change')),
  amount bigint not null default 0,             -- 원금상환액 / 이자 납부액
  new_rate numeric(6,3),                        -- 금리 변경 시
  expense_id uuid,                              -- 이자 납부 시 만든 비용 기록
  memo text,
  created_at timestamptz not null default now()
);
create index on loan_transactions(loan_id);

-- 비용 --------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,  -- 비우면 공통 비용
  owner_id uuid references owners(id) on delete set null,
  expense_date date not null,
  category text not null check (category in (
    'loan_interest', 'property_tax', 'comprehensive_tax', 'maintenance', 'electricity', 'water',
    'insurance', 'repair', 'brokerage', 'legal', 'cleaning', 'etc')),
  amount bigint not null check (amount >= 0),
  vendor text,
  memo text,
  loan_id uuid references loans(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on expenses(property_id);
create index on expenses(expense_date);

-- 문서 (파일은 DB 에 저장, 건당 최대 4MB) -------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  loan_id uuid references loans(id) on delete set null,
  category text not null default 'etc' check (category in (
    'lease', 'registry', 'building_ledger', 'business_license', 'tenant', 'loan', 'tax', 'etc')),
  title text,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  data bytea not null,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on documents(property_id);
create index on documents(contract_id);

-- 알림 --------------------------------------------------------------------
-- 앱 알림을 먼저 만들고, 채널(문자·카카오·이메일)별 발송은 notification_deliveries 에 기록한다.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'rent_due', 'rent_overdue', 'contract_expiry', 'deposit_return', 'loan_maturity', 'loan_interest', 'vacancy')),
  severity text not null default 'info' check (severity in ('critical', 'warning', 'caution', 'info')),
  title text not null,
  body text,
  ref_type text,             -- contract / charge / loan / unit
  ref_id uuid,
  property_id uuid references properties(id) on delete cascade,
  due_date date,
  dedupe_key text not null unique,   -- 같은 알림을 두 번 만들지 않도록
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications(created_at desc);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  channel text not null check (channel in ('sms', 'kakao', 'email', 'webhook')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- 설정 (계산식·알림 기준 등) -----------------------------------------------
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 변경 이력 ---------------------------------------------------------------
create table audit_logs (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs(entity, entity_id);

-- 미납 현황 뷰 (청구액 - 입금액 > 0 이고 납부일이 지난 것) --------------------
create view arrears as
select c.id as charge_id, c.contract_id, c.billing_month, c.due_date, c.amount, c.paid_amount,
       c.amount - c.paid_amount as unpaid_amount,
       (current_date - c.due_date) as overdue_days
from rent_charges c
where c.amount > c.paid_amount and c.due_date < current_date;

-- Supabase 로 배포할 때: 브라우저용 키(anon)로는 표를 읽지 못하게 막는다 (서버만 접근)
do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    foreach t in array array['users','owners','properties','units','tenants','contracts','deposits','rent_charges',
      'payments','payment_allocations','loans','loan_transactions','expenses','documents','notifications',
      'notification_deliveries','settings','audit_logs'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end loop;
    execute 'revoke all on public.arrears from anon, authenticated';
  end if;
end $$;
