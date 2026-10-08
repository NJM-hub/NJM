-- 배차·차량 관리 직원: 직원 회원가입 → staff_pending(승인 대기) → 관리자 승인 → staff
-- 직원은 운영 데이터(일정·배차·차량·기사·외부 콜)를 다루고, 정산·세무·설정은 관리자만.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff', 'staff_pending', 'driver'));
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists phone text;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
$$;

-- 가입 시 profiles 생성: 첫 가입자는 관리자, 직원 회원가입은 승인 대기, 그 외는 기사
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, role, name, phone)
  values (
    new.id,
    new.email,
    case
      when first_user then 'admin'
      when new.raw_user_meta_data ->> 'signup_type' = 'staff' then 'staff_pending'
      else 'driver'
    end,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- 운영 데이터: 관리자 + 승인된 직원
drop policy if exists "staff all vehicles" on public.vehicles;
create policy "staff all vehicles" on public.vehicles for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all drivers" on public.drivers;
create policy "staff all drivers" on public.drivers for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all uploads" on public.schedule_uploads;
create policy "staff all uploads" on public.schedule_uploads for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all bookings" on public.bookings;
create policy "staff all bookings" on public.bookings for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all runs" on public.dispatch_runs;
create policy "staff all runs" on public.dispatch_runs for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all assignments" on public.dispatch_assignments;
create policy "staff all assignments" on public.dispatch_assignments for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff geocode" on public.geocode_cache;
create policy "staff geocode" on public.geocode_cache for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff kkday statements" on public.kkday_statements;
create policy "staff kkday statements" on public.kkday_statements for all using (public.is_staff()) with check (public.is_staff());
-- 설정은 배차 계산에 필요해서 읽기만 (수정은 관리자)
drop policy if exists "staff reads settings" on public.app_settings;
create policy "staff reads settings" on public.app_settings for select using (public.is_staff());
