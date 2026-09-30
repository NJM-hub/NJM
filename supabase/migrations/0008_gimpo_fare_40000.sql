-- 김포공항 콜 금액을 4만원으로 (기본 콜 금액과 동일)
alter table public.app_settings alter column fare_gimpo set default 40000;
update public.app_settings set fare_gimpo = 40000 where id = 1 and fare_gimpo = 37000;
