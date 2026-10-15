-- 지입 차량(기사 소유 차량) 표시
alter table public.vehicles add column if not exists jiip boolean not null default false;
