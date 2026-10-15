-- 소속 기사 명단: 중국어 이름 (배차 화면에 한국어 이름과 같이 표시)
alter table public.driver_roster add column if not exists name_zh text;
