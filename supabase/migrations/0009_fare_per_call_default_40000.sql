-- 콜 기본 금액 초기값을 4만원으로 (새로 만드는 DB에도 같은 기준)
alter table public.app_settings alter column fare_per_call set default 40000;
update public.app_settings set fare_per_call = 40000 where id = 1 and fare_per_call = 50000;
