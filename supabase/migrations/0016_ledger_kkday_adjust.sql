-- 월별 정산표: KKday 정산 합계 조정 (잘못 정산된 금액 등, 마이너스면 차감)
alter table public.monthly_ledger add column if not exists kkday_adjust int not null default 0;
