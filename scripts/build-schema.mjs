/** Regenerates src/lib/schema.ts from scripts/schema.sql. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "scripts", "schema.sql"), "utf8");

const escaped = sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const target = path.join(root, "src", "lib", "schema.ts");
const contents = `/**
 * Generated from \`scripts/schema.sql\` by \`npm run schema\`.
 *
 * The schema is embedded rather than read from disk at runtime: a standalone or
 * containerised build does not ship the \`scripts/\` directory, and reading from
 * \`process.cwd()\` there fails at the first request.
 */
export const SCHEMA_SQL = String.raw\`${escaped}\`;
`;

// Rewriting an identical file churns file watchers for no reason, which in
// development restarts the server in the middle of whatever it was serving.
const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
if (current === contents) {
  console.log("src/lib/schema.ts is already up to date");
} else {
  fs.writeFileSync(target, contents);
  console.log("src/lib/schema.ts regenerated from scripts/schema.sql");
}
