-- 렌트카 배차 시스템 초기 스키마
-- Supabase SQL Editor 에서 그대로 실행하거나 `supabase db push` 로 적용한다.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- 사용자 역할
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'driver' check (role in ('admin', 'driver')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 가입 시 profiles 자동 생성. 첫 번째 가입자는 관리자.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when first_user then 'admin' else 'driver' end);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 차량
-- ─────────────────────────────────────────────
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  model text,
  seats int not null default 4 check (seats > 0),
  base_address text,
  base_lat double precision,
  base_lng double precision,
  active boolean not null default true,
  memo text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 기사 (민감정보는 애플리케이션에서 AES-256-GCM 으로 암호화하여 *_enc 컬럼에 저장)
-- ─────────────────────────────────────────────
create table public.drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  birth_date date,
  address text,
  rrn_enc text,                 -- 주민등록번호 (암호화)
  rrn_masked text,              -- 900101-1****** 형태
  bank_name text,
  bank_account_enc text,        -- 계좌번호 (암호화)
  bank_account_masked text,
  account_holder text,
  license_number text,
  license_expiry date,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'inactive')),
  privacy_consent_at timestamptz not null,
  third_party_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index drivers_vehicle_unique on public.drivers (vehicle_id) where vehicle_id is not null;

-- ─────────────────────────────────────────────
-- 일정표 업로드 / 예약
-- ─────────────────────────────────────────────
create table public.schedule_uploads (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  source text not null default 'kkday',
  service_date date,
  row_count int not null default 0,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.schedule_uploads (id) on delete cascade,
  service_date date,
  booking_no text,
  product_name text,
  customer_name text,
  customer_phone text,
  pax int not null default 1,
  pickup_at timestamptz,
  duration_min int,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  flight_no text,
  memo text,
  fare int,                      -- 건별 기사 지급액 (없으면 기본 단가)
  raw jsonb,
  created_at timestamptz not null default now()
);

create index bookings_service_date_idx on public.bookings (service_date);
-- 같은 예약번호·이용일을 다시 올리면 덮어쓴다 (booking_no 가 null 이면 중복 허용)
create unique index bookings_no_date_unique on public.bookings (booking_no, service_date);

-- ─────────────────────────────────────────────
-- 배차 실행 / 결과
-- ─────────────────────────────────────────────
create table public.dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  options jsonb not null default '{}',
  summary jsonb not null default '{}',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index dispatch_runs_date_idx on public.dispatch_runs (service_date, created_at desc);
-- 날짜별 확정 배차는 하나만
create unique index dispatch_runs_confirmed_unique on public.dispatch_runs (service_date) where status = 'confirmed';

create table public.dispatch_assignments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dispatch_runs (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  seq int,
  ready_at timestamptz,
  deadhead_km double precision,
  deadhead_min double precision,
  unassigned_reason text,
  fare int not null default 0,
  unique (run_id, booking_id)
);

create index dispatch_assignments_driver_idx on public.dispatch_assignments (driver_id);

-- ─────────────────────────────────────────────
-- 지오코딩 캐시 / 설정
-- ─────────────────────────────────────────────
create table public.geocode_cache (
  address text primary key,
  lat double precision,
  lng double precision,
  provider text,
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  max_calls_per_vehicle int not null default 4,
  buffer_min int not null default 15,
  default_duration_min int not null default 90,
  avg_speed_kmh int not null default 40,
  road_factor double precision not null default 1.3,
  unknown_travel_min int not null default 60,
  fare_per_call int not null default 50000,
  income_tax_rate double precision not null default 0.03,
  local_tax_rate double precision not null default 0.1,
  business_code text not null default '940909',
  company_name text,
  company_brn text,              -- 사업자등록번호
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.schedule_uploads enable row level security;
alter table public.bookings enable row level security;
alter table public.dispatch_runs enable row level security;
alter table public.dispatch_assignments enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.app_settings enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admin manage profiles" on public.profiles for update using (public.is_admin());

create policy "admin all vehicles" on public.vehicles for all using (public.is_admin()) with check (public.is_admin());
create policy "driver reads own vehicle" on public.vehicles for select
  using (exists (select 1 from public.drivers d where d.id = auth.uid() and d.vehicle_id = vehicles.id));

create policy "admin all drivers" on public.drivers for all using (public.is_admin()) with check (public.is_admin());
create policy "driver reads self" on public.drivers for select using (id = auth.uid());
create policy "driver inserts self" on public.drivers for insert
  with check (id = auth.uid() and status = 'pending' and vehicle_id is null);
-- 기사 본인 수정은 서버(서비스 롤)에서 허용된 컬럼만 처리하므로 update 정책은 두지 않는다.

create policy "admin all uploads" on public.schedule_uploads for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all runs" on public.dispatch_runs for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all assignments" on public.dispatch_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy "admin geocode" on public.geocode_cache for all using (public.is_admin()) with check (public.is_admin());
create policy "admin settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- 기사: 확정된 본인 배차와 해당 예약만 조회
-- (정책끼리 서로 참조하면 무한 재귀가 나므로 security definer 함수로 확인한다)
create or replace function public.run_is_confirmed(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dispatch_runs where id = p_run and status = 'confirmed');
$$;

create or replace function public.driver_has_booking(p_booking uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dispatch_assignments a
    join public.dispatch_runs r on r.id = a.run_id and r.status = 'confirmed'
    where a.booking_id = p_booking and a.driver_id = auth.uid()
  );
$$;

create or replace function public.driver_in_run(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dispatch_assignments where run_id = p_run and driver_id = auth.uid());
$$;

create policy "driver reads own confirmed assignments" on public.dispatch_assignments for select
  using (driver_id = auth.uid() and public.run_is_confirmed(run_id));
create policy "driver reads assigned bookings" on public.bookings for select
  using (public.driver_has_booking(id));
create policy "driver reads confirmed runs" on public.dispatch_runs for select
  using (status = 'confirmed' and public.driver_in_run(id));
