-- 우정렌트카 홈페이지: 렌트 차량 목록 · 상담 신청
-- 0001_init.sql 다음에 Supabase SQL Editor 에서 실행한다.

-- ─────────────────────────────────────────────
-- 홈페이지에 노출하는 렌트 차량 (배차용 vehicles 와 별개)
-- ─────────────────────────────────────────────
create table public.rental_cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- 예: 더 뉴 그랜저
  brand text,                               -- 예: 현대
  category text not null default '중형'
    check (category in ('경차', '소형', '준중형', '중형', '준대형', '대형', 'SUV', '승합', '수입', '전기')),
  year int,
  fuel text,                                -- 가솔린 / 디젤 / LPG / 하이브리드 / 전기
  seats int,
  rent_types text[] not null default '{short,rent}',  -- short(단기) · rent(월렌트) · long(장기) · accident(사고대차)
  daily_price int,                          -- 단기렌트 1일 요금
  monthly_price int,                        -- 월렌트 월 요금
  long_price int,                           -- 장기렌트 월 요금
  image_url text,
  description text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rental_cars_published_idx on public.rental_cars (published, sort_order);

-- ─────────────────────────────────────────────
-- 상담 신청 (홈페이지 문의 폼). 서버(서비스 롤)에서만 insert 한다.
-- ─────────────────────────────────────────────
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  name text not null,
  phone text not null,
  region text,
  car text,
  start_date date,
  period text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'done', 'canceled')),
  admin_memo text,
  privacy_consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index inquiries_created_idx on public.inquiries (created_at desc);

alter table public.rental_cars enable row level security;
alter table public.inquiries enable row level security;

create policy "public reads published cars" on public.rental_cars for select using (published or public.is_admin());
create policy "admin all cars" on public.rental_cars for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all inquiries" on public.inquiries for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────
-- 차량 사진 (공개 버킷, 업로드는 서버에서 관리자 확인 후 서비스 롤로)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('car-images', 'car-images', true)
on conflict (id) do nothing;
