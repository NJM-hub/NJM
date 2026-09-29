-- 기사가 외부에서 직접 받아온 콜(자체 콜): 출처와 고정 차량
alter table public.bookings add column if not exists source text;
alter table public.bookings add column if not exists fixed_vehicle_id uuid references public.vehicles (id) on delete set null;
