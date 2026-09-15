/**
 * Restores a backup over the live database. Deliberately manual and loud: it
 * refuses without an explicit file argument and moves the current database aside
 * rather than deleting it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.DATABASE_PATH ?? path.join(root, "data", "platform.db");
const source = process.argv[2];

if (!source) {
  console.error("Usage: npm run restore -- data/backups/platform-<timestamp>.db");
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`No such backup: ${source}`);
  process.exit(1);
}

console.log("Stop the application before restoring, then run this again if it is still running.\n");

if (fs.existsSync(target)) {
  const aside = `${target}.replaced-${Date.now()}`;
  fs.renameSync(target, aside);
  console.log(`Existing database moved to ${aside}`);
}

fs.copyFileSync(source, target);
console.log(`Restored ${source} → ${target}`);
