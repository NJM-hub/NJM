-- 월별 전체 정산표에서 직접 입력하는 지출 (차량 할부금, 원천 지출(현금), 사무실 지출)
create table if not exists public.monthly_ledger (
  month text primary key,
  vehicle_installment int not null default 0,
  cash_expense int not null default 0,
  office_expense int not null default 0,
  memo text,
  updated_at timestamptz not null default now()
);
alter table public.monthly_ledger enable row level security;
drop policy if exists "admin monthly ledger" on public.monthly_ledger;
create policy "admin monthly ledger" on public.monthly_ledger for all
  using (public.is_admin()) with check (public.is_admin());
