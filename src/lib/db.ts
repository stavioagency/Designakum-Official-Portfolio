import "server-only";
import { Pool, type PoolClient } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

declare global {
  // eslint-disable-next-line no-var
  var __designakumPool: Pool | undefined;
}

/**
 * Where the database is, according to whoever is running us.
 *
 * On Cloudflare the answer is a Hyperdrive binding rather than an environment
 * variable: it hands back a connection string pointing at a local proxy, and
 * Hyperdrive holds the warm connections to Supabase on the other side. That is
 * the whole reason to move — the pool no longer has to live inside a function
 * instance that may be discarded between requests.
 *
 * The lookup is guarded rather than imported at the top, because the module
 * only exists inside a Worker; on Node, in tests, and during `next build` it is
 * absent and DATABASE_URL is the answer.
 */
function hyperdriveConnectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as {
      HYPERDRIVE?: { connectionString?: string };
    };
    return env?.HYPERDRIVE?.connectionString;
  } catch {
    // Not running inside a Worker — `next dev`, `next build` and the tests all
    // land here, and DATABASE_URL is the right answer for all three.
    return undefined;
  }
}

/** Where the connection came from, for the health endpoint. Never the value. */
export function databaseSource(): "hyperdrive" | "env" | "missing" {
  if (hyperdriveConnectionString()) return "hyperdrive";
  return process.env.DATABASE_URL?.trim() ? "env" : "missing";
}

function resolveConnectionString(): string {
  const hyperdrive = hyperdriveConnectionString();
  if (hyperdrive) return hyperdrive;

  const fromEnv = process.env.DATABASE_URL;
  if (!fromEnv) {
    throw new Error(
      "No database connection. Set DATABASE_URL, or bind Hyperdrive on Cloudflare " +
        "(Supabase → Project Settings → Database → Connection string).",
    );
  }
  return fromEnv;
}

function createPool(): Pool {
  const connectionString = resolveConnectionString();
  // Hyperdrive terminates locally inside the Worker, so there is no TLS to
  // verify and no certificate chain to teach anything about.
  const viaHyperdrive = Boolean(hyperdriveConnectionString());

  return new Pool({
    connectionString,
    // Supabase terminates TLS with its own certificate chain; verifying it from a
    // serverless runtime needs the CA bundle, which the pooler URL does not carry.
    ssl:
      !viaHyperdrive && connectionString.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
    /**
     * Two connections per instance, released after ten seconds idle.
     *
     * This is a budget, not a performance dial. A serverless platform runs many
     * instances of this function at once and keeps them warm between requests,
     * so the pool size multiplies by however many instances exist — five each
     * was enough to exhaust Supabase's 200-client pooler limit and take the
     * site down with `max client connections reached`.
     *
     * Two still lets the queries a page issues together overlap, which is what
     * makes the console bearable across regions, while leaving room for roughly
     * a hundred concurrent instances. Raise DATABASE_POOL_MAX only alongside a
     * pooler that has the headroom for it.
     */
    // Hyperdrive is the pool now, so a Worker only needs a handful of local
    // sockets to it; without it we are still budgeting against Supabase's
    // 200-client ceiling across every warm instance.
    max: Number(process.env.DATABASE_POOL_MAX ?? (viaHyperdrive ? 5 : 2)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * The pool is built on first use, not on import.
 *
 * `next build` imports every route module to collect page data, so a pool
 * created at module scope made DATABASE_URL a *build-time* requirement — the
 * build failed on a machine that has no business holding the production
 * database credentials. Creating it lazily keeps the error where it belongs:
 * the first query of the first real request.
 *
 * Reused across hot reloads in development so a file save does not leak a pool.
 */
let pool: Pool | undefined;

/**
 * A Worker must not hold a connection pool.
 *
 * `pg.Pool` keeps sockets open between queries and hands them out again later.
 * In a Worker there is no "later" it can rely on — the runtime tears down the
 * context when a request finishes, and a pool waiting on a socket that will
 * never speak again is a Worker that hangs. The runtime then cancels it with
 * "your Worker's code had hung and would never generate a response", which is
 * exactly what the first deployment did on roughly one request in three.
 *
 * Hyperdrive already is the pool. So on Cloudflare each query opens a client to
 * the local Hyperdrive proxy, uses it, and closes it — cheap, because the
 * expensive half (the warm connection to Supabase across the ocean) lives in
 * Hyperdrive and outlives every request.
 */
async function withClient<T>(fn: (c: { query: Pool["query"] }) => Promise<T>): Promise<T> {
  const connectionString = hyperdriveConnectionString();
  if (!connectionString) return await fn(getPool());

  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client as unknown as { query: Pool["query"] });
  } finally {
    // Never let a close failure mask the caller's result or its error.
    await client.end().catch(() => {});
  }
}

function getPool(): Pool {
  // The module-level binding is what makes this a pool at all. Caching only on
  // globalThis in development meant production built a new Pool — and paid a
  // fresh TLS handshake to the pooler, about 800ms across an ocean — on every
  // single query, while leaking the connection behind it.
  pool ??= globalThis.__designakumPool ?? createPool();

  // The global is only for development: it survives a hot reload, so saving a
  // file does not strand the previous pool's connections.
  if (process.env.NODE_ENV !== "production") globalThis.__designakumPool = pool;

  return pool;
}

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

/**
 * Counts queries per request when DATABASE_DEBUG is set.
 *
 * Round trips are the dominant cost when the app and the database sit in
 * different regions, and the only way to know how many a page makes is to count
 * them. Off unless asked for.
 */
const debugQueries = process.env.DATABASE_DEBUG === "1";
let queryCount = 0;

function traceQuery(sql: string, ms: number) {
  queryCount += 1;
  console.log(`[db ${String(queryCount).padStart(3)}] ${ms.toFixed(0)}ms  ${sql.replace(/\s+/g, " ").slice(0, 70)}`);
}

export function resetQueryCount() {
  queryCount = 0;
}

export async function all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
  const started = debugQueries ? performance.now() : 0;
  const result = await withClient((c) => c.query(toPositional(sql), params as unknown[]));
  if (debugQueries) traceQuery(sql, performance.now() - started);
  return result.rows.map((row) => coerce<T>(row));
}

export async function get<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const started = debugQueries ? performance.now() : 0;
  const result = await withClient((c) => c.query(toPositional(sql), params as unknown[]));
  if (debugQueries) traceQuery(sql, performance.now() - started);
  return result.rows.length ? coerce<T>(result.rows[0]) : undefined;
}

export async function run(sql: string, ...params: unknown[]): Promise<void> {
  await withClient((c) => c.query(toPositional(sql), params as unknown[]));
}

/** Runs several statements atomically — used where a partial write would corrupt state. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const connectionString = hyperdriveConnectionString();

  // On Cloudflare, a dedicated client for the transaction: BEGIN and COMMIT have
  // to reach the same connection, and a pool that survives the request is what
  // hangs the Worker. See withClient above.
  if (connectionString) {
    const { Client } = await import("pg");
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client as unknown as PoolClient);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      await client.end().catch(() => {});
    }
  }

  const client = await getPool().connect();
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
