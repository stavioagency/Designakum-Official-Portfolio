# Designakum — منصة معارض الأعمال

A multi-tenant portfolio platform for designers, freelancers and creators.
Arabic-first (RTL) with full English (LTR) support, dark glassmorphism UI, and
every client with their own account, editor, subscription and public URL.

```bash
npm install
npm run migrate   # create/update the schema, then apply pending migrations
npm run seed      # demo owner + two client portfolios
npm run dev       # http://localhost:3000
```

Both read `DATABASE_URL`; `npm run migrate` falls back to the one in `.env.local`.

### Demo accounts

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Platform owner | `admin@designakum.sa` | `Admin#2026` | `/console` |
| Second owner | `owner2@designakum.sa` | `Owner2#2026` | `/console` |
| Support agent | `support@designakum.sa` | `Support#2026x` | `/console` (reduced) |
| Client (paid) | `faisal@designakum.sa` | `Faisal#2026` | `/dashboard` → `/p/faisal` |
| Client (free) | `noura@designakum.sa` | `Noura#2026` | `/dashboard` → `/p/noura` |
| Client (English interface) | `alex@designakum.sa` | `Alex#2026` | `/dashboard` → `/p/alex` |

The seed also leaves one open report, one open ticket, a live announcement and an
unused invitation code (`DZKM1-WELCM`) so the console has real work in it.

Copy `.env.example` to `.env.local` and fill in what you have. Nothing there is
required to run the app, but `AUTH_SECRET` should be set in production — the dev
fallback signs session cookies with a hard-coded key.

## Brand assets

Sign in as the platform owner and upload the artwork from **/admin → ملفات
الهوية البصرية**: one slot per file, with a preview and a replace/delete control.
Uploads are written to `public/brand/` under the fixed names listed in
[`public/brand/README.md`](public/brand/README.md), so you can also just copy the
files in by hand — either way the app picks them up on the next request, with no
rebuild.

Every logo falls back to type and the Riyal symbol falls back to `ر.س` / `SAR`
until its file exists, so the UI is never broken by a missing asset, and `/admin`
shows at a glance what is still missing. (Uploading needs a writable filesystem —
on read-only hosting, commit the files to `public/brand/` instead.) Brand blue (`#1b4d9b` → `#2563c9`) is the platform's default accent and
is defined once in `src/app/globals.css`.

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/` | public | Landing page + list of published portfolios |
| `/p/[slug]` | public | A client's portfolio. Unpublished pages show a "coming soon" card to everyone but their owner |
| `/portfolio/[slug]` | public | Legacy alias, redirects to `/p/[slug]` |
| `/pricing` | public | Plans and prices |
| `/signup`, `/login` | public | Client accounts — email/password or Continue with Google |
| `/api/auth/google` | public | OAuth start (PKCE); callback creates the account on first sign-in |
| `/dashboard/billing` | client | Current plan, what it includes, upgrade, redeem an invitation, cancel auto-renew |
| `/dashboard/support` | client | Raise and follow support tickets |
| `/console` | staff | Owner console — see below |
| `/admin` | — | Redirects to `/console` |
| `/dashboard` | client | Editor: profile, slides, projects, stats, socials, settings — with a live phone preview |
| `/dashboard/preview` | client | Full-page preview with phone/desktop toggle and the publish switch |
| `/admin` | owner | KPIs, create clients, suspend/reactivate, open any client |
| `/admin/clients/[id]` | owner | Plan, password reset, permanent delete, views chart, and the client's full editor |
| `/api/asset/[id]` | public | Serves uploaded images (sandboxed, immutable cache) |

The public portfolio and the editing interface share no layout, no navigation
and no client-side state — the editor never renders on a public page.

## Architecture

```
src/lib/          db.ts (schema + query helpers) · auth.ts (scrypt + signed cookie sessions)
                  portfolios.ts (repository + tenant gate) · assets.ts (image store) · types.ts
src/app/actions/  server actions: auth · portfolio (client edits) · admin (owner only)
src/app/          routes, grouped by audience
src/components/   portfolio-view (public render) · editor/* · admin/* · icons
scripts/          schema.pg.sql · migrations/* · migrate.mjs · seed.mjs · bootstrap.mjs
```

**Storage.** PostgreSQL through `pg`, hosted on Supabase. The schema lives in
`scripts/schema.pg.sql` with anything it cannot express in `scripts/migrations/`,
so the app and the seed script agree by construction. Every table is keyed by
`portfolio_id` and cascades from `users`, so deleting an account removes its
portfolio, projects, slides, stats, socials, sessions and images in one
statement. Uploaded images live in object storage (`src/lib/storage.ts`), not in
the database. Nothing above `src/lib/db.ts` knows which engine is underneath.

**Tenant isolation.** `assertCanEdit(portfolioId, user)` in
`src/lib/portfolios.ts` is the only door into a write. A client may touch only a
portfolio whose `user_id` is their own; the owner may touch any. Every
child-table statement *also* scopes by `portfolio_id`, so a forged child id from
another tenant matches zero rows rather than leaking across accounts. Suspending
an account revokes its sessions immediately.

**Auth.** Passwords are scrypt-hashed with a per-user salt and compared in
constant time. Sessions are rows in the database; the cookie carries only a
session id plus an HMAC, is `httpOnly`, and expires after 30 days.

**Images** are stored as blobs and served from `/api/asset/[id]` with
`nosniff` and a sandbox CSP. SVG uploads are rejected on purpose — they can carry
script and would run on the app's own origin.

**Layout.** The portfolio renders from container queries, not viewport
breakpoints, so the same component is correct at full width, inside the editor's
380px phone frame, and inside the preview page's device toggle.

**Language.** `src/lib/i18n.ts` holds one dictionary per locale, typed so English
cannot drift out of sync with Arabic. The visitor's choice is a cookie and drives
`<html lang>` / `dir`; a portfolio also stores its own locale, so an English page
renders LTR even for an Arabic-speaking visitor. Public surfaces (landing,
pricing, auth, portfolios, 404) are bilingual; the dashboards are Arabic.

**Sign-in with Google.** Authorisation-code flow with PKCE, implemented against
Google's endpoints directly — no extra dependency. State and verifier live in
`oauth_states` and are consumed once; `returnTo` is restricted to same-site paths
so it cannot become an open redirect. A first Google sign-in provisions the
account and portfolio; an existing email gets the Google identity linked to it.
The button only appears when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
both set.

**Images are the client's own.** Upload, crop (drag to frame, slider to zoom),
replace, remove and reorder. The cropper renders to a canvas and submits a WebP,
so the server stores exactly what the client framed. There is no image
generation anywhere in the product.

## Running in production

```bash
npm ci
npm run build
AUTH_SECRET="$(openssl rand -base64 48)" npm start
```

**Before the first real customer:**

1. `AUTH_SECRET` — required. The server refuses to serve a single request without
   at least 32 random characters, because a fallback secret in the repository
   would make every session forgeable.
2. Run behind TLS. `Strict-Transport-Security` and `secure` cookies switch on
   automatically in production.
3. Schedule backups: `npm run backup` writes a `pg_dump` of the database,
   verifies it, and keeps the newest 14. A daily cron entry is enough, with the
   directory shipped off-box. Supabase takes its own backups; this one exists so
   a copy lives somewhere Supabase does not control.
   Restore with `npm run restore -- data/backups/designakum-<timestamp>.sql`.
4. Fill in the terms and privacy text in the console settings; the pages are live
   and currently say the documents have not been published.
5. Connect a payment provider (see Billing) and an email provider (see below), or
   the platform cannot charge anyone or send a password reset.

**Schema changes.** `npm run migrate` applies `scripts/schema.pg.sql` — which is
idempotent and safe to re-run — and then any file in `scripts/migrations/` that
has not been applied yet, each in its own transaction, recorded in
`schema_migrations`. Anything the base schema cannot express (dropping a column,
backfilling a table) belongs in a numbered migration. Applied migrations are
history: their checksum is recorded and editing one afterwards is refused, so
write a new migration instead. `npm run migrate -- --dry` lists what is pending,
and `npm run migrate:down` reverts the most recent migration when it ships with a
matching `.down.sql`.

**Email.** `EMAIL_PROVIDER`, `EMAIL_API_KEY` and `EMAIL_FROM` enable password
reset delivery. Without them nothing is faked: the message is written to the
`mail_outbox` table, the customer is told delivery is unavailable and asked to
contact you, and the reset link simply is not sent.

**Errors.** Failures are always written to stderr as structured JSON. Set
`ERROR_WEBHOOK_URL` to forward the same payload to Sentry, Slack or any collector.

## Owner console

`/console` is the internal control centre, separate from the client dashboard and
invisible to clients (they are redirected to their own dashboard).

| Section | What it does |
| --- | --- |
| Overview | Live platform stats — users, active users, subscriptions by plan, comped accounts, suspensions, MRR, churn, open reports and tickets — plus a merged activity stream |
| Customers | Search, filter by plan/status/date, sort; profile with account, subscription, portfolio activity, reports, tickets and full account history; suspend, reactivate, reset password, grant/extend/cancel subscriptions, delete |
| Moderation | Report queue (pending → reviewing → resolved/dismissed) with assignment, internal notes, resolutions, and enforcement: warn, request removal, suspend a portfolio temporarily or permanently, ban an account, restore |
| Support | Ticket queue with search, assignment, priority, status, customer replies and staff-only internal notes |
| Invitations | Create link/code/email invitations with duration, expiry, use limit and notes; track who redeemed each one; revoke |
| Subscriptions | Plans and prices, revenue, conversion, churn, and every subscription with its source (paid / granted / invitation) |
| Analytics | Views, unique visitors, WhatsApp and social clicks, registrations, conversions, plan split, revenue, churn, most-viewed portfolios |
| Audit log | Every staff action — who, what, which account, when, and the before/after state — searchable and filterable |
| Announcements | Messages that appear inside client dashboards, with severity and a date window |
| Settings | Prices, free-plan limits, feature flags, maintenance mode, sign-up policy, brand text and artwork, support details, publishing rules and policies, staff accounts |

**Roles.** Authorisation is capability-based, not role-checked at the call site:
`src/lib/permissions.ts` maps a role to permissions, and every console route and
action asks for a capability. The `owner` role holds all of them; `support` can
work the customer, moderation, support and analytics queues but is kept out of
billing, invitations, settings, staff management and the audit log. Adding a role
later is a change to that one table. Pages redirect to the console with a notice
when a capability is missing; actions throw, since a blocked mutation is
exceptional rather than routine.

**Suspension** hides a portfolio from the public and can be time-limited (it lifts
itself on the next visit) or permanent. The client keeps every project, image and
setting, and the moderation history stays attached to the account.

**Audit.** `audit()` writes actor, action, target, free-text detail and JSON
before/after states. Every mutation in `src/app/actions/console.ts`,
`moderation.ts`, `support.ts`, `invitations.ts`, `announcements.ts` and
`settings.ts` records one.

**Content-Security-Policy** carries a per-request nonce, generated in
`src/middleware.ts` and stamped by Next onto every inline script it emits, with
`'strict-dynamic'` for the chunks those load. `'unsafe-inline'` is therefore off
for scripts in production; development keeps it alongside the nonce because React
Refresh needs `eval`, and a browser that understands nonces ignores it anyway.

**Rate limiting** is a fixed-window counter in the database (`src/lib/rate-limit.ts`),
applied to sign-in attempts, report submissions, ticket creation, invitation
redemption and the analytics endpoint. It survives a restart, which an in-memory
map would not.

**Maintenance mode** closes the landing page and the client dashboard while
leaving published portfolios online — those belong to customers, and their
visitors should not be taken down with us. Staff keep full access throughout.

**Settings** (`src/lib/settings.ts`) hold the defaults; the `settings` table only
stores overrides. Prices and free-plan limits are read through this on every page
that shows or enforces them, so changing the monthly price in the console updates
the public pricing page, the savings maths and the billing screens immediately.

## Billing

Two plans, defined once in `src/lib/billing.ts` and rendered everywhere from
those numbers:

| Plan | Price | Note |
| --- | --- | --- |
| `monthly` | 12 SAR / month | |
| `yearly` | 120 SAR / year | 12 months of monthly is 144 SAR, so this saves 24 SAR — 16.7% |

Amounts are held in halalas as integers; money never touches a float. A free
account is capped at 6 projects and 2 slides and carries a small Designakum
credit in its footer; an active subscription lifts the caps, drops the credit and
unlocks statistics and custom-domain eligibility. `entitlementsFor(user)` is the
single place those rules live.

**No payment processing is faked.** `billingProvider()` returns null until
`BILLING_PROVIDER` and `BILLING_SECRET_KEY` are both set, and the UI says plainly
that checkout is unavailable rather than pretending a charge happened.
Implementing the `BillingProvider` interface and returning it from that function
is the only change a real provider needs — `recordSubscription()`, the
`subscriptions` table and the entitlement checks are already provider-agnostic,
and a webhook can push status changes in at any time. Meanwhile the platform
owner can grant or end a subscription directly from `/admin/clients/[id]`; those
are recorded against the `manual` provider so the billing history stays honest
about where each subscription came from.

## Adding a client

Either the owner creates one from `/admin` (account + portfolio + starter
content in one step), or the client signs up at `/signup`. Both paths call
`createPortfolio()` + `seedStarterContent()`, so a new portfolio is never empty.
Close public signup by removing the `/signup` route if the platform should be
invite-only.

## Tests

```bash
npm test          # unit + integration (needs the dev server running)
npm run test:unit # unit only
```

The integration suite mints real session cookies and drives the running
application over HTTP, so it exercises the actual authorization paths: forged and
unknown session signatures, a client reaching for the console, a support agent
reaching for the audit log, one customer reaching for another's ticket, suspended
portfolios, stored `javascript:` links, security headers, and that the console's
revenue figure matches what the database supports.

## Launch readiness

[`LAUNCH.md`](LAUNCH.md) is the audit: every finding, its priority, and its
current status.

## Ready for, not yet built

`portfolios.custom_domain` (unique) is in place for custom domains, `page_views`
already records per-day analytics that the owner's client page charts, and the
`billing_events` table gives a real provider somewhere to write its webhook
history.
