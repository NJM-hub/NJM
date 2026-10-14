-- 관리자 회원(manager): 관리자 회원가입 → manager_pending(승인 대기) → 관리자(admin) 승인 → manager
-- 운영 데이터(일정·배차·차량·외부 콜)는 직원처럼 다루고, 기사·차량별 월정산·정산·세무는 보기만, 설정·직원·백업은 불가
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'staff', 'staff_pending', 'manager', 'manager_pending', 'driver'));

-- 운영 데이터 권한: 관리자 + 직원 + 관리자 회원
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff', 'manager'));
$$;

-- 정산 자료 보기: 관리자 + 관리자 회원
create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'));
$$;

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
      when new.raw_user_meta_data ->> 'signup_type' = 'manager' then 'manager_pending'
      else 'driver'
    end,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- 정산 자료는 관리자 회원도 읽기만 (수정은 기존 관리자 정책)
drop policy if exists "viewer reads vehicle month expenses" on public.vehicle_month_expenses;
create policy "viewer reads vehicle month expenses" on public.vehicle_month_expenses for select using (public.is_viewer());
drop policy if exists "viewer reads vehicle month items" on public.vehicle_month_items;
create policy "viewer reads vehicle month items" on public.vehicle_month_items for select using (public.is_viewer());
drop policy if exists "viewer reads monthly ledger" on public.monthly_ledger;
create policy "viewer reads monthly ledger" on public.monthly_ledger for select using (public.is_viewer());
drop policy if exists "viewer reads monthly ledger items" on public.monthly_ledger_items;
create policy "viewer reads monthly ledger items" on public.monthly_ledger_items for select using (public.is_viewer());
drop policy if exists "viewer reads driver roster" on public.driver_roster;
create policy "viewer reads driver roster" on public.driver_roster for select using (public.is_viewer());
drop policy if exists "viewer reads driver month notes" on public.driver_month_notes;
create policy "viewer reads driver month notes" on public.driver_month_notes for select using (public.is_viewer());
