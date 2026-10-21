-- Golden Car 예약 문의 저장용 테이블 (Supabase SQL Editor 에서 한 번 실행)
create table if not exists public.rental_inquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  vehicle text not null,
  start_date date not null,
  end_date date not null,
  purpose text not null,
  notes text not null default '',
  status text not null default '신규'
);

-- 외부(브라우저)에서는 읽기·쓰기 불가. 홈페이지 서버만 service role 키로 저장합니다.
alter table public.rental_inquiries enable row level security;
