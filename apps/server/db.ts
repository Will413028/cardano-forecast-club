import pg from "pg";
export type DbClient = Pick<pg.PoolClient, "query">;
import { readFile } from "node:fs/promises";
export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://forecast:forecast-local-only@127.0.0.1:54329/forecast";
export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10000,
  query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS ?? 30000),
  statement_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS ?? 30000),
  options: process.env.DATABASE_SCHEMA
    ? `-c search_path=${process.env.DATABASE_SCHEMA}`
    : undefined,
});
pool.on("error", () =>
  console.error(JSON.stringify({ event: "database_idle_connection_failed" })),
);
export async function migrate() {
  const c = await pool.connect();
  try {
    await c.query(
      "SELECT pg_advisory_lock(hashtext('forecast-migration:' || current_schema()))",
    );
    await c.query(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
  } finally {
    try {
      await c.query(
        "SELECT pg_advisory_unlock(hashtext('forecast-migration:' || current_schema()))",
      );
    } finally {
      c.release();
    }
  }
}
export async function transaction<T>(
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
