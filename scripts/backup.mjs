/**
 * Point-in-time dump of the database.
 *
 * Supabase already takes its own automated backups; this exists so you also hold
 * a copy somewhere Supabase does not control, which is the difference between a
 * backup and a single point of failure.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
const outDir = process.env.BACKUP_DIR ?? path.join(root, "data", "backups");
const keep = Number(process.env.BACKUP_KEEP ?? 14);

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `designakum-${stamp}.sql`);

const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", "--clean", "--if-exists", url], {
  stdio: ["ignore", fs.openSync(target, "w"), "inherit"],
});

dump.on("error", (error) => {
  console.error(
    error.code === "ENOENT"
      ? "pg_dump not found. Install the PostgreSQL client tools (brew install libpq)."
      : error.message,
  );
  process.exit(1);
});

dump.on("close", (code) => {
  if (code !== 0) {
    console.error(`pg_dump exited with ${code}`);
    process.exit(code ?? 1);
  }

  const size = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
  console.log(`Backup written: ${target} (${size} MB)`);

  const backups = fs
    .readdirSync(outDir)
    .filter((name) => name.startsWith("designakum-") && name.endsWith(".sql"))
    .sort()
    .reverse();

  for (const stale of backups.slice(keep)) {
    fs.unlinkSync(path.join(outDir, stale));
    console.log(`Removed old backup: ${stale}`);
  }
});
