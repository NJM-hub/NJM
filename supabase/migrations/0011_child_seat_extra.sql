-- 어린이 좌석 추가금 (좌석 1개당, 피켓 추가금과 별도로 더한다)
alter table public.app_settings add column if not exists fare_child_seat_extra int not null default 5000;
