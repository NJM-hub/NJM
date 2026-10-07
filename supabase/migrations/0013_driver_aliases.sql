-- 같은 사람인데 이름이 다르게 적힌 기사 (한 줄에 "다른 이름 = 정산에 쓸 이름")
alter table public.app_settings add column if not exists driver_aliases text not null default '';
-- 9660 김성원과 JACKY, 9757 여호란과 여호연은 같은 사람
update public.app_settings set driver_aliases = E'김성원 = JACKY\n여호란 = 여호연' where id = 1 and driver_aliases = '';
