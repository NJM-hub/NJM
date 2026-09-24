-- 우정렌트카 홈페이지: 고객 회원 · 쿠폰
-- 0003_site_info_events.sql 다음에 Supabase SQL Editor 에서 실행한다.

-- ─────────────────────────────────────────────
-- 역할에 고객(customer) 추가
-- ─────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'driver', 'customer'));

-- ─────────────────────────────────────────────
-- 고객 정보
-- ─────────────────────────────────────────────
create table public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  privacy_consent_at timestamptz not null,
  marketing_consent_at timestamptz,        -- 광고성 정보 수신 동의 (선택)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 쿠폰
-- ─────────────────────────────────────────────
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null,                     -- 예: 첫 월렌트 5만원 할인
  description text,
  code text unique,                        -- 고객이 직접 등록하는 코드 (없으면 코드 등록 불가)
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value int not null check (discount_value > 0),
  service text,                            -- 적용 서비스 (사고대차/단기렌트/월렌트/장기렌트). null 이면 전체
  valid_until date,                        -- null 이면 기한 없음
  issue_on_signup boolean not null default false,  -- 회원가입 시 자동 발급
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customer_coupons (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  unique (coupon_id, customer_id)
);

create index customer_coupons_customer_idx on public.customer_coupons (customer_id);

-- 상담 신청: 로그인 고객 연결 · 사용할 쿠폰
alter table public.inquiries add column user_id uuid references auth.users (id) on delete set null;
alter table public.inquiries add column customer_coupon_id uuid references public.customer_coupons (id) on delete set null;
create index inquiries_user_idx on public.inquiries (user_id);

-- ─────────────────────────────────────────────
-- 가입 트리거: 홈페이지 회원가입(account_type=customer)이면 고객으로 만들고 가입 쿠폰을 발급한다.
-- 첫 번째 관리자는 고객 가입으로는 생기지 않는다.
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_customer boolean := coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'customer';
  first_staff boolean;
begin
  if is_customer then
    insert into public.profiles (id, email, role) values (new.id, new.email, 'customer');
    insert into public.customers (id, name, phone, email, privacy_consent_at, marketing_consent_at)
    values (
      new.id,
      left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), '고객'), 30),
      left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 20),
      new.email,
      now(),
      case when new.raw_user_meta_data ->> 'marketing_consent' = 'true' then now() end
    );
    insert into public.customer_coupons (coupon_id, customer_id)
    select c.id, new.id from public.coupons c
    where c.issue_on_signup and c.active and (c.valid_until is null or c.valid_until >= current_date);
    return new;
  end if;

  select not exists (select 1 from public.profiles where role <> 'customer') into first_staff;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when first_staff then 'admin' else 'driver' end);
  return new;
end;
$$;

-- 기사 등록은 기사 계정만
drop policy if exists "driver inserts self" on public.drivers;
create policy "driver inserts self" on public.drivers for insert
  with check (
    id = auth.uid() and status = 'pending' and vehicle_id is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'driver')
  );

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.customers enable row level security;
alter table public.coupons enable row level security;
alter table public.customer_coupons enable row level security;

-- 고객 정보 수정·쿠폰 등록은 서버(서비스 롤)에서 허용된 컬럼만 처리하므로 조회 정책만 둔다.
create policy "customer reads self" on public.customers for select using (id = auth.uid());
create policy "admin all customers" on public.customers for all using (public.is_admin()) with check (public.is_admin());

create policy "customer reads own coupons" on public.customer_coupons for select using (customer_id = auth.uid());
create policy "admin all customer coupons" on public.customer_coupons for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.holds_coupon(p_coupon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customer_coupons where coupon_id = p_coupon and customer_id = auth.uid());
$$;
create policy "customer reads held coupons" on public.coupons for select using (public.holds_coupon(id));
create policy "admin all coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

create policy "customer reads own inquiries" on public.inquiries for select using (user_id = auth.uid());
