import "server-only";
import pg from "pg";

// DATE → 'YYYY-MM-DD' 문자열, bigint/numeric → number (원 단위는 9천조까지 안전)
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

/** DB 주소: 직접 넣은 DATABASE_URL → Vercel+Supabase 연결 시 자동으로 생기는 POSTGRES_URL */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || null;
}

const globalForPg = globalThis as unknown as { __rentalPool?: pg.Pool };

function pool(): pg.Pool {
  if (globalForPg.__rentalPool) return globalForPg.__rentalPool;
  const url = databaseUrl();
  if (!url) throw new Error("DB 주소(DATABASE_URL)가 설정되지 않았습니다. README 의 설치 방법을 확인하세요.");
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const p = new pg.Pool({
    connectionString: url.split("?")[0],
    // Supabase 풀러 인증서는 자체 CA 로 서명되어 있어 검증을 끈다 (전송 구간은 TLS 로 암호화됨)
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 10_000,
  });
  // 쉬고 있는 연결을 DB 가 끊어도(Neon 자동 절전 등) 서버가 죽지 않도록. 다음 요청 때 새로 연결한다
  p.on("error", (e) => console.error("[db] idle connection closed:", e.message));
  globalForPg.__rentalPool = p;
  return p;
}

export type Queryable = Pick<pg.PoolClient, "query">;

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = [], c?: Queryable): Promise<T[]> {
  const r = await (c ?? pool()).query(sql, params);
  return r.rows as T[];
}

export async function q1<T = Record<string, unknown>>(sql: string, params: unknown[] = [], c?: Queryable): Promise<T | null> {
  const rows = await q<T>(sql, params, c);
  return rows[0] ?? null;
}

/** 트랜잭션 */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** 변경 이력 */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: unknown,
  c?: Queryable,
) {
  await q(
    "insert into audit_logs (actor_id, action, entity, entity_id, detail) values ($1, $2, $3, $4, $5)",
    [actorId, action, entity, entityId, detail == null ? null : JSON.stringify(detail)],
    c,
  );
}

/** 테이블이 만들어져 있는지 (처음 설치 안내용) */
export async function schemaReady(): Promise<{ ok: boolean; error?: string }> {
  if (!databaseUrl()) return { ok: false, error: "no-url" };
  try {
    const r = await q<{ ok: boolean }>("select to_regclass('public.users') is not null as ok");
    return { ok: !!r[0]?.ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
