import "server-only";
import { Pool, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __designakumPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy the connection string from Supabase " +
        "(Project Settings → Database → Connection string → Transaction pooler).",
    );
  }

  return new Pool({
    connectionString,
    // Supabase terminates TLS with its own certificate chain; verifying it from a
    // serverless runtime needs the CA bundle, which the pooler URL does not carry.
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
    // Serverless invocations are short-lived and numerous; a small pool per
    // instance keeps us well inside the pooler's connection budget.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Reused across hot reloads in development so a file save does not leak a pool.
export const pool: Pool = globalThis.__designakumPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__designakumPool = pool;

/**
 * The queries in this codebase were written with `?` placeholders. Rewriting all
 * of them to `$1, $2, …` by hand would be a large, error-prone diff for no gain,
 * so the driver's numbering is applied here instead — skipping anything inside a
 * string literal, which is where a literal question mark could legitimately live.
 */
export function toPositional(sql: string): string {
  let out = "";
  let index = 0;
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (quote) {
      out += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === "?") {
      out += `$${++index}`;
      continue;
    }
    out += char;
  }

  return out;
}

type Row = Record<string, unknown>;

/**
 * `bigint` columns arrive as strings from the driver, because a 64-bit integer
 * does not always fit a JavaScript number. Every bigint in this schema is either a
 * millisecond timestamp or a counter, both comfortably inside Number.MAX_SAFE_INTEGER,
 * so they are converted once here rather than at every call site.
 */
function coerce<T>(row: Row): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" && /^-?\d+$/.test(value) && key !== "id" && isNumericColumn(key)
      ? Number(value)
      : value;
  }
  return out as T;
}

const NUMERIC_SUFFIXES = [
  "_at",
  "_end",
  "count",
  "views",
  "seq",
  "position",
  "amount",
  "months",
  "max_uses",
  "used_count",
  "byte_size",
  "published",
  "suspended",
  "active",
  "internal",
  "revoked",
  "delivered",
  "two_factor_enabled",
  "cancel_at_period_end",
  "window_start",
  "n",
];

const isNumericColumn = (key: string) =>
  NUMERIC_SUFFIXES.some((suffix) => key === suffix || key.endsWith(suffix));

export async function all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await pool.query(toPositional(sql), params as unknown[]);
  return result.rows.map((row) => coerce<T>(row));
}

export async function get<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const result = await pool.query(toPositional(sql), params as unknown[]);
  return result.rows.length ? coerce<T>(result.rows[0]) : undefined;
}

export async function run(sql: string, ...params: unknown[]): Promise<void> {
  await pool.query(toPositional(sql), params as unknown[]);
}

/** Runs several statements atomically — used where a partial write would corrupt state. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function now() {
  return Date.now();
}
