# Deploying Designakum

Two targets are described here: **Netlify**, which runs today, and **Cloudflare**,
which needs code changes first. The differences are at the bottom.

## Netlify

### 1. Connect the repository

Netlify → **Add new site** → **Import an existing project** → GitHub →
`stavioagency/Designakum-Official-Portfolio`.

Leave the build settings alone. `netlify.toml` already sets the build command,
the publish directory, the Node version and the Next.js runtime plugin.

### 2. Environment variables

Site configuration → **Environment variables**. The first three are required —
the app refuses to serve a request without `AUTH_SECRET`, and cannot do anything
useful without a database.

| Variable | Value | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 48` | **Required.** At least 32 characters. Sessions are forgeable without it. |
| `DATABASE_URL` | Supabase **pooled** URI | **Required.** Port **6543**, not 5432 — see below. |
| `SITE_URL` | `https://<your-site>.netlify.app` | Used by robots.txt, the sitemap and links in email. |
| `STORAGE_DRIVER` | `supabase` | Without this, uploads try to write to a local disk that does not persist. |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Server-side only. Never expose it to the browser. |
| `SUPABASE_STORAGE_BUCKET` | `portfolio-images` | Create it as a **private** bucket. |
| `EMAIL_PROVIDER` | `resend` | |
| `EMAIL_API_KEY` | Resend API key | |
| `EMAIL_FROM` | `Designakum <no-reply@designakum.com>` | The domain must be verified in Resend. |
| `PAYPAL_ENV` | `sandbox` | `live` only when you are ready to take real money. |
| `PAYPAL_CLIENT_ID` | PayPal app credentials | |
| `PAYPAL_CLIENT_SECRET` | PayPal app credentials | |
| `PAYPAL_WEBHOOK_ID` | *(after the first deploy)* | See step 4. |
| `REPORTING_TIMEZONE` | `Asia/Riyadh` | Optional; this is the default. |

**Use the pooled connection string.** Supabase gives two: direct (5432) and pooled
(6543). Every serverless function instance opens its own connection, so the direct
one runs out of connections under any real traffic. This has nothing to do with
the free tier — a paid plan hits the same wall.

### 3. First deploy

Deploy the site, then from your own machine, pointed at the same database:

```bash
npm run migrate
```

```bash
OWNER_EMAIL=you@example.com OWNER_NAME="Your Name" OWNER_PASSWORD='a-long-password' npm run bootstrap
```

`bootstrap` creates the first owner account. It refuses to run if an owner
already exists, so it is safe to re-run.

Do **not** run `npm run seed` against production — it is development data and
refuses to run against a non-local database.

### 4. PayPal webhook

Only possible once the site has a public URL.

PayPal Developer → your app → **Webhooks** → Add:

- URL: `https://<your-site>.netlify.app/api/billing/paypal/webhook`
- Events: `BILLING.SUBSCRIPTION.ACTIVATED`, `.CANCELLED`, `.EXPIRED`,
  `.SUSPENDED`, `.PAYMENT.FAILED`, and `PAYMENT.SALE.COMPLETED`

Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID` and redeploy. Until it is set,
every event is rejected as unverified — which is the safe direction, but it means
a cancellation made on PayPal's side will not reach the platform.

### 5. Check it came up

Start at `/api/health`. It answers `200` when the platform can actually serve,
and `503` with a breakdown when it cannot — which variable is missing, and
whether the database answered. It reports presence, never values.

```json
{ "ok": true, "config": { "AUTH_SECRET": true, "DATABASE_URL": true }, "database": { "ok": true } }
```

Then, by hand:

- `/` renders and offers the language choice
- `/robots.txt` and `/sitemap.xml` answer
- Sign in as the bootstrapped owner and open `/console`
- Upload an image in the editor — proves storage and the signed URLs work
- Trigger a password reset — proves email works

## Backups

The Supabase free plan takes none. `.github/workflows/backup.yml` runs a nightly
`pg_dump` in GitHub Actions, encrypts it with GPG, and keeps it as an artefact
for 90 days, so the only copy of the data is not the live database and is not in
the same account as it.

Two repository secrets are needed, under Settings, Secrets and variables,
Actions:

| Secret | What |
| --- | --- |
| `DATABASE_URL` | Supabase → Connect → **Session pooler**, port 5432. Not the direct host: it resolves to IPv6 only and a GitHub runner is IPv4, so the job cannot reach it. Not the transaction pooler on 6543 either, which `pg_dump` cannot use. |
| `BACKUP_PASSPHRASE` | A long random passphrase, kept somewhere other than GitHub. Without it the backups cannot be read, and neither can anyone else read them. |

Until both are set the job logs a warning and takes no backup, rather than
failing an email into your inbox every night. Run it once by hand from the
Actions tab to prove it works, and download the artefact to prove you can
decrypt it:

```
gpg --decrypt designakum.sql.gpg > designakum.sql
psql "$DATABASE_URL" < designakum.sql
```

A backup nobody has restored is a hypothesis. Restore one into a scratch
database once before launch.

## Custom domains

A customer adding a domain has to end up in two places: this database, and the
hosting account that answers for the hostname. The second half is
`src/lib/vercel-domains.ts`, and it is optional:

| Variable | What |
| --- | --- |
| `VERCEL_TOKEN` | An API token with access to the project. Server-side only; nothing ships it to a browser. |
| `VERCEL_PROJECT_ID` | The project id from Settings, General. |
| `VERCEL_TEAM_ID` | Only when the project belongs to a team rather than a personal account. |

With these set, adding a domain in the customer dashboard registers it with the
host, and removing it releases it. Without them nothing breaks: the domain is
recorded and verified exactly as before, and a member of staff attaches it by
hand in the dashboard. The customer is never shown a message about credentials
the platform failed to configure.

**The recommendation is to leave them unset.** A Vercel token cannot be scoped
to a single project, so whatever the application held could also delete the
project it runs on, and the application is the public web server: the most
exposed thing in the stack. `.github/workflows/domains.yml` does the same job
from CI every ten minutes, where the token sits in GitHub's secret store and
nothing is listening on port 443. It only ever attaches hostnames already
recorded in our own database, so it cannot be talked into claiming a domain
nobody asked for.

Either way, **Console → Domains** lists every customer domain and its state, so
the step can always be done by hand.

A domain held by a different hosting account is reported back plainly, because
that is the one case only the customer can fix.

## Exchange rates

The Gulf currencies are central bank pegs and live in `src/lib/currency.ts`.
Sterling and the Australian dollar float and are taken from the European Central
Bank's daily set through `api.frankfurter.dev`, refreshed at most once a day,
after the response has been sent rather than during it. A figure typed into
console settings overrides the feed; zero hands it back. Nothing blocks on the
feed, and a rate outside its historical range is refused rather than priced from.

## Cloudflare

DNS and email routing stay on Cloudflare. Hosting does not.

Not yet possible without code changes. Three things stand in the way:

1. **Password hashing.** `scryptSync` from `node:crypto` is not implemented in
   the Workers runtime. PBKDF2 through WebCrypto is. Changing it means existing
   hashes have to be re-derived, which can only happen when each person next
   types their password — so this is close to free before launch and painful
   after it.
2. **Postgres.** `pg` opens a raw TCP socket, which Workers cannot do without
   Hyperdrive in front of it, or a swap to an HTTP-based driver.
3. **Two filesystem reads.** `brand.ts` checks `public/brand/` at runtime to see
   which logo files exist; that needs to become a build-time manifest. The other,
   a development session-secret file in `auth.ts`, is already unused in
   production.
