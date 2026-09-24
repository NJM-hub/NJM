#!/usr/bin/env bash
# Supabase DB 에 supabase/migrations/*.sql 을 순서대로 적용한다. 이미 적용된 파일은 건너뛴다.
#
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<비밀번호>@<host>:5432/postgres" npm run db:migrate
#
# 연결 문자열: Supabase 대시보드 > Connect > Session pooler (IPv4 환경에서도 동작)
# 옵션: --seed  예시 차량(supabase/seed_cars.sql)도 넣는다 (차량이 하나도 없을 때만)
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL 환경변수를 설정하세요 (Supabase > Connect > Session pooler 연결 문자열)}"
cd "$(dirname "$0")/.."
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -X)

q() { "${PSQL[@]}" -tAc "$1"; }

"${PSQL[@]}" -c "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());" >/dev/null
# 마이그레이션 기록 테이블은 API 로 노출하지 않는다
"${PSQL[@]}" -c "alter table public._migrations enable row level security;" >/dev/null

# 이 스크립트 이전에 SQL Editor 로 직접 실행한 파일은 대표 테이블로 판단해 기록만 남긴다.
already_applied() {
  case "$1" in
    0001_init.sql) q "select to_regclass('public.profiles') is not null" ;;
    0002_site.sql) q "select to_regclass('public.rental_cars') is not null" ;;
    0003_site_info_events.sql) q "select to_regclass('public.site_info') is not null" ;;
    0004_customers_coupons.sql) q "select to_regclass('public.customers') is not null" ;;
    *) echo f ;;
  esac
}

for file in supabase/migrations/*.sql; do
  name=$(basename "$file")
  if [ "$(q "select exists (select 1 from public._migrations where name = '$name')")" = "t" ]; then
    echo "· $name (이미 적용됨)"
    continue
  fi
  if [ "$(already_applied "$name")" = "t" ]; then
    q "insert into public._migrations (name) values ('$name')" >/dev/null
    echo "· $name (이미 적용되어 있어 기록만 남김)"
    continue
  fi
  echo "▶ $name 적용 중..."
  # 파일 전체와 기록을 한 트랜잭션으로: 중간에 실패하면 아무것도 바뀌지 않는다.
  "${PSQL[@]}" --single-transaction -f "$file" -c "insert into public._migrations (name) values ('$name');"
  echo "✓ $name"
done

if [ "${1:-}" = "--seed" ]; then
  if [ "$(q "select count(*) from public.rental_cars")" = "0" ]; then
    "${PSQL[@]}" --single-transaction -f supabase/seed_cars.sql
    echo "✓ 예시 차량 추가"
  else
    echo "· 차량이 이미 있어 예시 차량은 넣지 않음"
  fi
fi

echo "완료"
