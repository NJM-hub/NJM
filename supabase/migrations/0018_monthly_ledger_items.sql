-- 월별 정산표 지출 상세 내역 (차량 할부금 / 원천 지출 / 현금 지출 / 사무실 지출)
-- 상세 내역이 있는 항목은 정산표에서 그 합계를 쓴다
create table if not exists public.monthly_ledger_items (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null check (category in ('installment', 'withholding', 'cash', 'office')),
  spent_on date,
  description text not null default '',
  amount int not null default 0,
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists monthly_ledger_items_month on public.monthly_ledger_items (month, category);
alter table public.monthly_ledger_items enable row level security;
drop policy if exists "admin monthly ledger items" on public.monthly_ledger_items;
create policy "admin monthly ledger items" on public.monthly_ledger_items for all using (public.is_admin()) with check (public.is_admin());
