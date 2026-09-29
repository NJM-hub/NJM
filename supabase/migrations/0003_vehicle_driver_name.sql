-- 기사 계정 없이도 차량에 담당 기사 이름을 적어둔다 (배차 시트 가져오기 시 자동 입력)
alter table public.vehicles add column if not exists driver_name text;
