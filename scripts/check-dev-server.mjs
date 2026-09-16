/**
 * The tests drive a running dev server, so a dead one fails every HTTP test at
 * once — twelve red tests that look like a regression and are not one. The
 * usual cause is `npm run build`, which writes to .next while `next dev` is
 * holding it; `npm run build:local` exists to avoid that.
 */
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

try {
  const response = await fetch(BASE, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
} catch {
  console.error(
    `\n  No dev server answering at ${BASE}.\n` +
      "  Start it — or restart it if you just ran a production build, which\n" +
      "  rebuilds .next underneath it. Use `npm run build:local` to avoid that.\n",
  );
  process.exit(1);
}
