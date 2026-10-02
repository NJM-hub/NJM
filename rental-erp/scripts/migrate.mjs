// 배포(빌드) 전에 db/migrations/*.sql 을 순서대로 한 번씩 자동 적용한다.
// Vercel 에서 Supabase 를 연결하면 생기는 POSTGRES_URL_NON_POOLING, 또는 직접 넣은 DATABASE_URL 로 접속한다.
// DB 주소가 없으면(내 컴퓨터, 아직 Supabase 연결 전) 조용히 건너뛴다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] DB 주소(DATABASE_URL / POSTGRES_URL)가 없어 건너뜀");
  process.exit(0);
}

// 이미 손으로 SQL Editor 에서 실행한 경우 나오는 "이미 있음" 오류 코드
const ALREADY_EXISTS = new Set(["42P07", "42710", "42723", "42P06", "42P16"]);

const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Supabase 풀러 인증서는 자체 CA 로 서명되어 있어 검증을 끈다 (전송 구간은 TLS 로 암호화됨)
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({
  connectionString: url.split("?")[0],
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(`
    create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());
    alter table public._migrations enable row level security;
    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on public._migrations from anon, authenticated;
      end if;
    end $$;
  `);
  let applied = 0;
  for (const f of files) {
    await client.query("begin");
    try {
      // 여러 배포가 동시에 돌아도 한 번만 적용되도록 잠금 (트랜잭션이 끝나면 자동 해제)
      await client.query("select pg_advisory_xact_lock(727276)");
      const { rowCount } = await client.query("select 1 from public._migrations where name = $1", [f]);
      if (rowCount) {
        await client.query("commit");
        continue;
      }
      console.log(`[migrate] 적용: ${f}`);
      await client.query("savepoint m");
      try {
        await client.query(readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        if (!ALREADY_EXISTS.has(e.code)) throw e;
        // SQL Editor 로 이미 직접 실행해 둔 경우: 기록만 남기고 넘어간다
        await client.query("rollback to savepoint m");
        console.log(`[migrate] ${f}: 이미 적용되어 있음 (${e.message}) → 적용된 것으로 기록`);
      }
      await client.query("insert into public._migrations (name) values ($1)", [f]);
      await client.query("commit");
      applied++;
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log(`[migrate] 완료: 새로 적용 ${applied}개 / 전체 ${files.length}개`);
} finally {
  await client.end();
}
