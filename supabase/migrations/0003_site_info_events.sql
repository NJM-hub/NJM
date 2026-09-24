-- 우정렌트카 홈페이지: 회사 정보(관리자 화면에서 입력) · 이벤트
-- 0002_site.sql 다음에 Supabase SQL Editor 에서 실행한다.

-- ─────────────────────────────────────────────
-- 회사 정보 (한 줄). 비어 있는 항목은 홈페이지에서 숨긴다.
-- ─────────────────────────────────────────────
create table public.site_info (
  id int primary key default 1 check (id = 1),
  name text not null default '우정렌트카',
  legal_name text,              -- 상호 (예: (주)우정렌트카)
  phone text,                   -- 대표번호
  hours text not null default '08:00 ~ 21:00',
  accident_hours text not null default '사고 접수는 24시간 받습니다',
  kakao_url text,               -- 카카오톡 채널 채팅 URL
  ceo text,
  brn text,                     -- 사업자등록번호
  address text,
  email text,
  privacy_officer text,         -- 개인정보관리책임자
  updated_at timestamptz not null default now()
);
insert into public.site_info (id) values (1);

alter table public.site_info enable row level security;
create policy "public reads site info" on public.site_info for select using (true);
create policy "admin updates site info" on public.site_info for update using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────
-- 이벤트
-- ─────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text,
  image_url text,
  starts_on date,
  ends_on date,                 -- 비우면 상시 진행
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_published_idx on public.events (published, created_at desc);

alter table public.events enable row level security;
create policy "public reads published events" on public.events for select using (published or public.is_admin());
create policy "admin all events" on public.events for all using (public.is_admin()) with check (public.is_admin());
