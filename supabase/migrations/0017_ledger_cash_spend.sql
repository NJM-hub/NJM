-- 월별 정산표: 원천 지출 옆 현금 지출
alter table public.monthly_ledger add column if not exists cash_spend int not null default 0;
