-- 기사 지급표: 미지급 / 지급완료
alter table public.driver_month_notes add column if not exists paid boolean not null default false;
alter table public.driver_month_notes add column if not exists paid_at timestamptz;
