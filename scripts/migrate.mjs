// 빌드 전에 supabase/migrations/*.sql 을 순서대로 한 번씩 적용한다.
// Vercel 빌드 환경(POSTGRES_URL_NON_POOLING 설정됨)에서만 실행되고, 로컬에서는 건너뛴다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url || !process.env.VERCEL) {
  console.log("[migrate] Vercel 빌드 환경이 아니므로 건너뜀");
  process.exit(0);
}

const dir = path.join(import.meta.dirname, "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Supabase 풀러 인증서는 자체 CA 로 서명되어 있어 검증을 끈다 (전송 구간은 TLS 로 암호화됨)
const client = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  // 동시에 여러 빌드가 돌아도 한 번만 적용되도록 잠금
  await client.query("select pg_advisory_lock(727274)");
  await client.query(`
    create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());
    alter table public._migrations enable row level security;
  `);
  const { rows } = await client.query("select name from public._migrations");
  const applied = new Set(rows.map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));
  for (const f of pending) {
    console.log(`[migrate] 적용: ${f}`);
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, f), "utf8"));
      await client.query("insert into public._migrations (name) values ($1)", [f]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log(`[migrate] 완료: 새로 적용 ${pending.length}개 / 전체 ${files.length}개`);
} finally {
  await client.query("select pg_advisory_unlock(727274)").catch(() => {});
  await client.end();
}
