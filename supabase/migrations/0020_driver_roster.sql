-- 소속 기사 명단 (가입 계정 없이 관리자가 직접 입력). 주민번호·계좌는 암호화해서 저장
create table if not exists public.driver_roster (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  phone text,
  rrn_enc text,
  rrn_masked text,
  bank_name text,
  bank_account_enc text,
  bank_account_masked text,
  account_holder text,
  active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.driver_roster enable row level security;
drop policy if exists "admin driver roster" on public.driver_roster;
create policy "admin driver roster" on public.driver_roster for all using (public.is_admin()) with check (public.is_admin());

-- 월별 기사 지급표의 비고 (정산 단위별)
create table if not exists public.driver_month_notes (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  unit_key text not null,
  note text,
  updated_at timestamptz not null default now(),
  primary key (month, unit_key)
);
alter table public.driver_month_notes enable row level security;
drop policy if exists "admin driver month notes" on public.driver_month_notes;
create policy "admin driver month notes" on public.driver_month_notes for all using (public.is_admin()) with check (public.is_admin());
