-- 차량별 월정산 보강: 금액 규칙, 직접 추가 항목(TALIXO 등), 정산 확정 잠금

-- 콜 금액 규칙 (기본 fare_per_call / 김포공항 / 피켓 추가금)
alter table public.app_settings add column if not exists fare_gimpo int not null default 37000;
alter table public.app_settings add column if not exists fare_picket_extra int not null default 5000;
-- 정산서 기준 기본 콜 금액 4만원 (처음 설정값 5만원 그대로인 경우만)
update public.app_settings set fare_per_call = 40000 where id = 1 and fare_per_call = 50000;

-- 배차에 없는 콜을 정산에 직접 추가 (TALIXO, 다른 플랫폼, 기타 가감)
create table if not exists public.vehicle_month_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  work_date date not null,
  work_time text,
  source text not null default 'TALIXO',
  ref_no text,
  trip_type text,
  flight_no text,
  vehicle_class text,
  pax int,
  memo text,
  amount int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_month_items_idx on public.vehicle_month_items (vehicle_id, month);
alter table public.vehicle_month_items enable row level security;
drop policy if exists "admin vehicle month items" on public.vehicle_month_items;
create policy "admin vehicle month items" on public.vehicle_month_items for all using (public.is_admin()) with check (public.is_admin());

-- 정산 확정: 확정하면 수정 잠금 + 확정 시점 내역(snapshot)을 기사에게 보여준다
alter table public.vehicle_month_expenses add column if not exists status text not null default 'draft';
alter table public.vehicle_month_expenses add column if not exists confirmed_at timestamptz;
alter table public.vehicle_month_expenses add column if not exists driver_id uuid references public.drivers (id) on delete set null;
alter table public.vehicle_month_expenses add column if not exists snapshot jsonb;
do $$ begin
  alter table public.vehicle_month_expenses add constraint vehicle_month_expenses_status_check check (status in ('draft', 'confirmed'));
exception when duplicate_object then null; end $$;

drop policy if exists "driver reads own confirmed settlement" on public.vehicle_month_expenses;
create policy "driver reads own confirmed settlement" on public.vehicle_month_expenses for select
  using (driver_id = auth.uid() and status = 'confirmed');
