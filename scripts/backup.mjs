/**
 * Consistent backup of the live database.
 *
 * A plain file copy of a SQLite database that is being written to can capture a
 * torn page, so this uses SQLite's own VACUUM INTO, which writes a complete,
 * checkpointed copy while the app keeps serving.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.DATABASE_PATH ?? path.join(root, "data", "platform.db");
const outDir = process.env.BACKUP_DIR ?? path.join(root, "data", "backups");
const keep = Number(process.env.BACKUP_KEEP ?? 14);

if (!fs.existsSync(source)) {
  console.error(`No database at ${source}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `platform-${stamp}.db`);

const db = new DatabaseSync(source, { readOnly: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();

const size = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
console.log(`Backup written: ${target} (${size} MB)`);

// Rotate: keep the newest `keep` files, drop the rest.
const backups = fs
  .readdirSync(outDir)
  .filter((name) => name.startsWith("platform-") && name.endsWith(".db"))
  .sort()
  .reverse();

for (const stale of backups.slice(keep)) {
  fs.unlinkSync(path.join(outDir, stale));
  console.log(`Removed old backup: ${stale}`);
}

const verify = new DatabaseSync(target, { readOnly: true });
const users = verify.prepare("SELECT COUNT(*) AS n FROM users").get();
const portfolios = verify.prepare("SELECT COUNT(*) AS n FROM portfolios").get();
verify.close();
console.log(`Verified: ${users.n} users, ${portfolios.n} portfolios.`);
