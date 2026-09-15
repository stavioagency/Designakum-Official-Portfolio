import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "platform.db");

declare global {
  // eslint-disable-next-line no-var
  var __portfolioDb: DatabaseSync | undefined;
}


/**
 * Columns added after the first release. `CREATE TABLE IF NOT EXISTS` never
 * touches an existing table, so new columns are added here instead — each guarded
 * by a pragma check, which makes the whole step idempotent.
 */
const ADDED_COLUMNS: [table: string, column: string, definition: string][] = [
  ["users", "google_id", "TEXT"],
  ["users", "avatar_url", "TEXT NOT NULL DEFAULT ''"],
  ["users", "auth_provider", "TEXT NOT NULL DEFAULT 'password'"],
  ["users", "locale", "TEXT NOT NULL DEFAULT 'ar'"],
  ["users", "two_factor_secret", "TEXT NOT NULL DEFAULT ''"],
  ["users", "two_factor_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "last_seen_at", "INTEGER"],
  ["portfolios", "suspended", "INTEGER NOT NULL DEFAULT 0"],
  ["portfolios", "suspended_reason", "TEXT NOT NULL DEFAULT ''"],
  ["portfolios", "suspended_at", "INTEGER"],
  ["portfolios", "suspended_until", "INTEGER"],
  ["subscriptions", "amount", "INTEGER NOT NULL DEFAULT 0"],
  ["subscriptions", "source", "TEXT NOT NULL DEFAULT 'paid'"],
  ["subscriptions", "started_at", "INTEGER"],
  ["subscriptions", "canceled_at", "INTEGER"],
];

function migrate(db: DatabaseSync) {
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  // Plans were renamed when real pricing landed: free/pro/business → free/monthly/yearly.
  db.exec("UPDATE users SET plan = 'monthly' WHERE plan = 'pro'");
  db.exec("UPDATE users SET plan = 'yearly' WHERE plan = 'business'");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id) WHERE google_id IS NOT NULL");
}

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA_SQL);
  migrate(db);
  return db;
}

export const db: DatabaseSync = globalThis.__portfolioDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__portfolioDb = db;

type Row = Record<string, unknown>;

/**
 * node:sqlite hands back null-prototype objects, which React refuses to send
 * across the server/client boundary — so every row is copied into a plain one.
 */
const plain = <T,>(row: unknown): T => ({ ...(row as object) }) as T;

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return (db.prepare(sql).all(...(params as never[])) as unknown[]).map((r) => plain<T>(r));
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const row = db.prepare(sql).get(...(params as never[]));
  return row === undefined ? undefined : plain<T>(row);
}

export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}

export function now() {
  return Date.now();
}
