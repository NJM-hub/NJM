-- 굿리뷰: 배차 시트의 기사 칸 아래(입금 줄 밑)에 적힌 예약번호 = 그 기사가 그 예약으로 굿리뷰를 받음 → 그 예약 정산에 +3,000원
create table if not exists public.good_reviews (
  booking_no text primary key,
  driver_label text not null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  sheet_date date not null,
  amount integer not null default 3000,
  created_at timestamptz not null default now()
);
alter table public.good_reviews enable row level security;
drop policy if exists "staff good reviews" on public.good_reviews;
create policy "staff good reviews" on public.good_reviews for all using (public.is_staff()) with check (public.is_staff());
