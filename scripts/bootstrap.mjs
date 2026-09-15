/**
 * Creates the first platform owner on a fresh database.
 *
 * Deliberately separate from `seed`, which exists to make a *development*
 * database look busy. Production gets one real account and nothing else — no
 * fake designers on the public showcase at launch.
 *
 * The password is read from the environment and never passed on a command line,
 * where it would land in shell history.
 *
 *   OWNER_EMAIL=you@designakum.com OWNER_PASSWORD='…' npm run bootstrap
 */
import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
let password = process.env.OWNER_PASSWORD ?? "";
const name = process.env.OWNER_NAME ?? "مالك المنصة";

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Set OWNER_EMAIL to a valid email address.");
  process.exit(1);
}

if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Password for the owner account: ");
  rl.close();
}

if (password.length < 12) {
  console.error("\nAn owner password must be at least 12 characters.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});

const existing = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'owner'");
if (existing.rows[0].n > 0 && process.env.ALLOW_EXTRA_OWNER !== "yes") {
  console.error(
    `\nThis database already has ${existing.rows[0].n} owner account(s).\n` +
      "Add further staff from the console (Settings → فريق المنصة), or set\n" +
      "ALLOW_EXTRA_OWNER=yes if you are certain.\n",
  );
  await pool.end();
  process.exit(1);
}

const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("hex")}$${scryptSync(password.normalize("NFKC"), salt, 64).toString("hex")}`;
const id = `usr_${randomBytes(9).toString("hex")}`;
const ts = Date.now();

await pool.query(
  `INSERT INTO users (id, email, password_hash, display_name, role, status, plan, created_at, updated_at)
   VALUES ($1, $2, $3, $4, 'owner', 'active', 'yearly', $5, $5)`,
  [id, email, hash, name, ts],
);

await pool.query(
  `INSERT INTO audit_log (id, actor_id, actor_email, actor_role, action, target_type, target_id,
     target_label, detail, created_at)
   VALUES ($1, $2, $3, 'owner', 'platform.bootstrapped', 'user', $2, $3, 'First owner account created', $4)`,
  [`aud_${randomBytes(9).toString("hex")}`, id, email, ts],
);

await pool.end();

console.log(`\nOwner account created: ${email}`);
console.log("Sign in at /login — you will land on /console.\n");
