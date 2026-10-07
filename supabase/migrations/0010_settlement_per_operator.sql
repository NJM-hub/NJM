-- 같은 차량을 여러 기사가 운행하면 기사별로 따로 정산한다.
-- operator = '' 는 차량 담당 기사(기본), 그 외는 시트 기사 칸의 운행 기사 이름(한국어 표시 이름).
alter table public.vehicle_month_expenses add column if not exists operator text not null default '';
alter table public.vehicle_month_expenses drop constraint if exists vehicle_month_expenses_pkey;
alter table public.vehicle_month_expenses add primary key (vehicle_id, month, operator);

alter table public.vehicle_month_items add column if not exists operator text not null default '';
create index if not exists vehicle_month_items_vehicle_month_operator_idx on public.vehicle_month_items (vehicle_id, month, operator);
