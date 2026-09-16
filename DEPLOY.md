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

## Cloudflare

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
