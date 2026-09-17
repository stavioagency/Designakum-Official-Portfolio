#!/usr/bin/env node
/**
 * Schema migrations.
 *
 * `scripts/schema.pg.sql` is the base schema and is idempotent — it is applied
 * on every run so a fresh database comes up complete. Anything the base schema
 * cannot express (dropping a column, backfilling a table, renaming) lives in
 * `scripts/migrations/NNNN_name.sql` and is applied once, in order, inside a
 * transaction, and recorded in `schema_migrations`.
 *
 *   npm run migrate          apply the base schema, then anything pending
 *   npm run migrate -- --dry list what would be applied and stop
 *   npm run migrate -- --if-configured  skip silently with no DATABASE_URL
 *   npm run migrate:down     revert the most recent migration (needs a .down.sql)
 *
 * A migration that has already been applied is never re-run, and editing one
 * after the fact is refused: its checksum is recorded, and a mismatch means the
 * file on disk no longer describes the database.
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(here, "migrations");
const BASE = path.join(here, "schema.pg.sql");

const connectionString =
  process.env.DATABASE_URL ??
  (() => {
    // Next reads .env.development.local in development only, which keeps it out
    // of the Worker bundle; .env.local stays supported for older checkouts.
    for (const name of [".env.development.local", ".env.local"]) {
      const file = path.join(process.cwd(), name);
      if (!fs.existsSync(file)) continue;
      const found = fs.readFileSync(file, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
      if (found) return found;
    }
    return undefined;
  })();

/**
 * `--if-configured` turns a missing database into a skip rather than a failure.
 *
 * This runs as part of the build, and `next build` deliberately does not need
 * database credentials — the pool is built lazily so a machine with no business
 * holding them can still build. Without this flag, adding migrations to the
 * build would take that away and fail any build run without a DATABASE_URL.
 *
 * A configured database that then fails to migrate is still fatal, which is the
 * point: a deploy must not ship code whose schema never arrived.
 */
if (!connectionString) {
  if (process.argv.includes("--if-configured")) {
    console.log("No DATABASE_URL — skipping migrations.");
    process.exit(0);
  }
  console.error("DATABASE_URL is not set, and .env.local does not carry one.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry");
const down = args.has("--down");

const checksum = (sql) => createHash("sha256").update(sql).digest("hex").slice(0, 16);

const migrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at BIGINT NOT NULL
  )
`);

const applied = new Map(
  (await client.query("SELECT version, checksum FROM schema_migrations")).rows.map((r) => [
    r.version,
    r.checksum,
  ]),
);

try {
  if (down) {
    await revertLast();
  } else {
    await applyPending();
  }
} finally {
  await client.end();
}

async function applyPending() {
  // Drift check first: a changed file means the database and the repo disagree
  // about history, and applying more on top of that only buries the problem.
  for (const file of migrationFiles()) {
    const version = file.replace(/\.sql$/, "");
    const recorded = applied.get(version);
    if (!recorded) continue;
    const current = checksum(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
    if (recorded !== current) {
      console.error(
        `${version} has been edited since it was applied (recorded ${recorded}, file ${current}).\n` +
          "Applied migrations are history. Write a new migration instead of changing this one.",
      );
      process.exit(1);
    }
  }

  const pending = migrationFiles().filter((f) => !applied.has(f.replace(/\.sql$/, "")));

  if (dryRun) {
    console.log("Base schema: scripts/schema.pg.sql (idempotent, applied every run)");
    console.log(pending.length ? `Pending:\n  ${pending.join("\n  ")}` : "Pending: none");
    return;
  }

  await client.query(fs.readFileSync(BASE, "utf8"));
  console.log("✓ base schema");

  for (const file of pending) {
    const version = file.replace(/\.sql$/, "");
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ($1, $2, $3)",
        [version, checksum(sql), Date.now()],
      );
      await client.query("COMMIT");
      console.log(`✓ ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`✗ ${version} failed and was rolled back:\n${error.message}`);
      process.exit(1);
    }
  }

  if (!pending.length) console.log("No pending migrations.");
}

async function revertLast() {
  const last = (
    await client.query("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
  ).rows[0];
  if (!last) {
    console.log("Nothing to revert.");
    return;
  }

  const downFile = path.join(MIGRATIONS, `${last.version}.down.sql`);
  if (!fs.existsSync(downFile)) {
    console.error(
      `${last.version} has no ${path.basename(downFile)}, so it cannot be reverted automatically.\n` +
        "Restore from a backup instead: npm run restore.",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(`Would revert ${last.version}`);
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(fs.readFileSync(downFile, "utf8"));
    await client.query("DELETE FROM schema_migrations WHERE version = $1", [last.version]);
    await client.query("COMMIT");
    console.log(`✓ reverted ${last.version}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`✗ reverting ${last.version} failed and was rolled back:\n${error.message}`);
    process.exit(1);
  }
}
