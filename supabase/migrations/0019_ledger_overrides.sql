-- 월별 정산표: 비용·기사 지급을 직접 고친 값 (비어 있으면 차량별 월정산에서 자동 계산)
alter table public.monthly_ledger add column if not exists cost_override int;
alter table public.monthly_ledger add column if not exists driver_pay_override int;
