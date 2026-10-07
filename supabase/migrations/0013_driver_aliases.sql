-- 같은 사람인데 이름이 다르게 적힌 기사 (한 줄에 "다른 이름 = 정산에 쓸 이름")
alter table public.app_settings add column if not exists driver_aliases text not null default '';
-- 9660 김성원과 JACKY 는 같은 사람 → JACKY 로 정산
update public.app_settings set driver_aliases = '김성원 = JACKY' where id = 1 and driver_aliases = '';
