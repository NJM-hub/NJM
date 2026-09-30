-- 차량별 월정산
-- 외부오더(기사 자체 콜) 1건당 차감액
alter table public.app_settings add column if not exists own_call_fee int not null default 15000;

-- 정산 금액을 건별로 고칠 때 (없으면 배차 지급액, 자체 콜은 -차감액)
alter table public.dispatch_assignments add column if not exists settle_amount int;

-- 차량별 월 비용 (정산 금액에서 빼고 세금을 계산)
create table if not exists public.vehicle_month_expenses (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  fuel int not null default 0,         -- 주유
  fines int not null default 0,        -- 과태료
  tolls int not null default 0,        -- 통행료
  engine_oil int not null default 0,   -- 엔진오일
  other int not null default 0,        -- 기타
  memo text,
  updated_at timestamptz not null default now(),
  primary key (vehicle_id, month)
);
alter table public.vehicle_month_expenses enable row level security;
drop policy if exists "admin vehicle month expenses" on public.vehicle_month_expenses;
create policy "admin vehicle month expenses" on public.vehicle_month_expenses for all using (public.is_admin()) with check (public.is_admin());
