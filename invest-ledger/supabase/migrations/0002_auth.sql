-- =====================================================================
-- 5단계: 로그인·권한
-- Supabase → SQL Editor 에 이 파일 전체를 붙여넣고 [Run] 을 누르세요.
-- 여러 번 실행해도 안전합니다.
--
--  * profiles(사용자)에 이메일·마지막 로그인·세션 버전 추가
--  * 누가 등록/수정했는지 기록: 앱 서버가 요청 헤더(x-actor-id)로 로그인 사용자 id 를 보내면
--    created_by 와 변경 이력(audit_logs.actor)에 자동으로 들어간다
-- =====================================================================

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists last_login_at timestamptz;
-- 비밀번호 변경·계정 중지 시 올려서 기존 로그인을 모두 끊는다
alter table public.profiles add column if not exists session_version integer not null default 1;
create unique index if not exists profiles_email_uq on public.profiles (lower(email)) where email <> '';

-- 요청한 사용자 id (앱 서버가 보낸 x-actor-id 헤더). 없거나 형식이 틀리면 null
create or replace function public.request_actor()
returns uuid language plpgsql stable set search_path = '' as $$
declare v text;
begin
  v := nullif(current_setting('request.headers', true), '')::json ->> 'x-actor-id';
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;
  return null;
exception when others then
  return null;
end $$;

-- 등록자 자동 기록
alter table public.customers   alter column created_by set default public.request_actor();
alter table public.investments alter column created_by set default public.request_actor();
alter table public.repayments  alter column created_by set default public.request_actor();

-- 변경 이력에 수정한 사람 기록
create or replace function public.write_audit_log()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.audit_logs (table_name, row_id, action, old_data, new_data, actor)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new),
    coalesce(auth.uid(), public.request_actor())
  );
  return new;
end $$;

-- 브라우저용 키로는 호출 못 하게
revoke all on function public.request_actor() from public, anon, authenticated;
grant execute on function public.request_actor() to service_role;
