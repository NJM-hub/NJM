-- KKday 정산내역서: 예약번호별 최종 정산 금액(부가세 포함, 예약 성립 + 취소 환불 + 부분 환불 합계)
-- 외부로 준 콜의 차액 = 정산 금액에서 부가세를 뺀 금액 − 외부 업체에 준 금액
create table if not exists public.kkday_statements (
  booking_no text primary key,
  amount int not null,
  lines int not null default 1,
  service_date date,
  status text,
  uploaded_at timestamptz not null default now()
);
alter table public.kkday_statements enable row level security;
drop policy if exists "admin kkday statements" on public.kkday_statements;
create policy "admin kkday statements" on public.kkday_statements for all using (public.is_admin()) with check (public.is_admin());
