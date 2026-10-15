-- 소속 기사 명단은 직원도 보기만 (주민번호·계좌는 일부만 보이는 칸, 수정은 관리자만)
drop policy if exists "staff reads driver roster" on public.driver_roster;
create policy "staff reads driver roster" on public.driver_roster for select using (public.is_staff());
