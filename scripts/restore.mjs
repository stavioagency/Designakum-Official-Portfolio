/**
 * Restores a dump over the database named by DATABASE_URL.
 * Deliberately manual and loud: it destroys whatever is there now.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";

const url = process.env.DATABASE_URL;
const source = process.argv[2];

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!source || !fs.existsSync(source)) {
  console.error("Usage: npm run restore -- data/backups/designakum-<timestamp>.sql");
  process.exit(1);
}

console.log(`Restoring ${source} into the database named by DATABASE_URL.`);
console.log("This replaces the current contents. Stop the application first.\n");

const psql = spawn("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", source], { stdio: "inherit" });
psql.on("close", (code) => {
  console.log(code === 0 ? "\nRestore complete." : `\npsql exited with ${code}`);
  process.exit(code ?? 1);
});
