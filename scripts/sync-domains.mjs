/**
 * Attaches customer domains to the hosting account.
 *
 * This runs in CI rather than in the app, and that is the whole point. A Vercel
 * token cannot be scoped to a single project: any token the application held
 * could also delete the project it runs on. The application is a public web
 * server and the most likely thing in the stack to be compromised, so the
 * credential lives where nothing is listening on port 443.
 *
 * It only ever adds hostnames that are already recorded in our own database as
 * belonging to a portfolio, so a bug here cannot be talked into claiming a
 * domain nobody asked for.
 *
 * Needs DATABASE_URL, VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID when
 * the project belongs to a team.
 */
import pg from "pg";

const { DATABASE_URL, VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env;

if (!DATABASE_URL || !VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.log("Not configured, so nothing was done.");
  process.exit(0);
}

const team = VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : "";
const api = `https://api.vercel.com/v10/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/domains${team}`;

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

const { rows } = await pool.query(
  "SELECT hostname FROM domains WHERE status IN ('pending', 'active') ORDER BY created_at",
);

let added = 0;
let already = 0;
const problems = [];

for (const { hostname } of rows) {
  const response = await fetch(api, {
    method: "POST",
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: hostname }),
  });

  if (response.ok) {
    added++;
    console.log(`added ${hostname}`);
    continue;
  }

  const body = await response.json().catch(() => null);
  const code = body?.error?.code ?? String(response.status);

  // Already on this project is the state we were aiming for.
  if (code === "domain_already_in_use_by_this_project" || code === "domain_already_exists") {
    already++;
    continue;
  }

  problems.push(`${hostname}: ${code}`);
}

await pool.end();

console.log(`${rows.length} domains: ${added} added, ${already} already attached.`);
if (problems.length) {
  // Not a failed run: a domain held by somebody else's account is the
  // customer's to resolve, and failing here would page us nightly about it.
  console.log("::warning::Could not attach: " + problems.join("; "));
}
