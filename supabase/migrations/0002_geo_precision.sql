-- 좌표 정확도: exact(지도 검색으로 찾은 위치) / area(구·동네 중심으로 추정한 위치)
alter table public.bookings add column if not exists pickup_geo text check (pickup_geo in ('exact', 'area'));
alter table public.bookings add column if not exists dropoff_geo text check (dropoff_geo in ('exact', 'area'));

-- 이미 좌표가 있는 예약은 정확한 위치로 본다 (공항 좌표 등)
update public.bookings set pickup_geo = 'exact' where pickup_lat is not null and pickup_geo is null;
update public.bookings set dropoff_geo = 'exact' where dropoff_lat is not null and dropoff_geo is null;
