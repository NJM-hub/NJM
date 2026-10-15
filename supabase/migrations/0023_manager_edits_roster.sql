-- 관리자 회원도 기사 메뉴(소속 기사 명단·월별 지급표 비고)는 수정 가능
drop policy if exists "viewer reads driver roster" on public.driver_roster;
drop policy if exists "viewer all driver roster" on public.driver_roster;
create policy "viewer all driver roster" on public.driver_roster for all using (public.is_viewer()) with check (public.is_viewer());
drop policy if exists "viewer reads driver month notes" on public.driver_month_notes;
drop policy if exists "viewer all driver month notes" on public.driver_month_notes;
create policy "viewer all driver month notes" on public.driver_month_notes for all using (public.is_viewer()) with check (public.is_viewer());
