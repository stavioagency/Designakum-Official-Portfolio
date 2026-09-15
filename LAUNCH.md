# Designakum — launch readiness

Audit of the whole application against a real commercial launch. Status is updated
as items are fixed: ✅ done · ⏳ in progress · ⛔ blocked on something you must provide.

---

## Critical — do not launch without these

| # | Finding | Status |
| --- | --- | --- |
| C1 | **Script injection through stored links.** `social.url`, `project.link` and a reporter's `evidence_url` were rendered into `href` with no scheme check, so a `javascript:` value ran script on a visitor's click — and on a staff member's click inside the console. | ✅ |
| C2 | **Session secret had a public fallback.** With `AUTH_SECRET` unset, cookies were signed with a hard-coded key from the repository: anyone could forge a session for any account. | ✅ |
| C3 | **No security headers.** No CSP, framing, referrer, MIME-sniffing or HSTS policy on any response. | ✅ |
| C4 | **The seed script deletes accounts by email.** Run against production by accident, it would have destroyed real customers. | ✅ |
| C5 | **No backups and no stated deployment constraint.** SQLite with no backup procedure, and nothing documenting that the app must run as a single instance. | ✅ |
| C6 | **Customers could not change their own password.** No rotation after a leak; only an owner could reset it for them. | ✅ |
| C7 | **No payment provider connected — the platform cannot take money.** The architecture is ready and refuses to fake a charge; it needs real credentials. | ⛔ needs your provider account |

## High — fix before taking real customers

| # | Finding | Status |
| --- | --- | --- |
| H1 | No rate limit on sign-up, so accounts and portfolios could be created in bulk. | ✅ |
| H2 | No email at all: no password reset, no notification when support replies. | ✅ layer built, ⛔ needs SMTP credentials |
| H3 | Terms and privacy text existed in settings but no page rendered it. | ✅ |
| H4 | No automated tests over authentication, tenant isolation or entitlements. | ✅ |
| H5 | Uploaded images stayed publicly served after a portfolio was suspended. | ✅ |
| H6 | Schema was read from `process.cwd()` at runtime, which breaks a standalone deploy. | ✅ |
| H7 | No error reporting — a production failure would be invisible. | ✅ |
| H8 | `users.plan` could drift out of step with the real subscription. | ✅ |
| H9 | Maintenance mode left customer portfolios online with no way to change that. | ✅ now takes them down by default, with a switch |
| H10 | SQLite had no busy timeout, so two concurrent writes raised `SQLITE_BUSY` instead of queuing. Found by the new test suite. | ✅ |

### Still needed from you

- **A payment provider account** (C7). Implement `BillingProvider` in
  `src/lib/billing.ts` and set `BILLING_PROVIDER` / `BILLING_SECRET_KEY`. Until
  then checkout is disabled and subscriptions can only be granted by an owner.
- **Email credentials** (H2). Set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY` and
  `EMAIL_FROM`. The flow is built and rate limited; without credentials the reset
  link is recorded in `mail_outbox` and the customer is told to contact you.
- **Terms and privacy text** (H3). The pages are live and currently state the
  documents are unpublished. Paste the text into console settings.
- **`AUTH_SECRET`** on the production host, and TLS in front of the app.

## Migration to Supabase + Vercel — done

| Item | Status |
| --- | --- |
| PostgreSQL schema, hand-written (BIGINT timestamps, explicit `seq` for insertion order) | ✅ |
| Data layer ported from `node:sqlite` to `pg` — 132 functions and 135 call sites now async | ✅ |
| SQLite-only SQL translated: `rowid`, `date(…,'unixepoch')`, `GROUP_CONCAT`, `COLLATE NOCASE`, `LIKE`, unqualified `ON CONFLICT` arithmetic | ✅ |
| Images moved out of the database into object storage (local driver in dev, private Supabase bucket in production) | ✅ |
| Upload size brought under Vercel's 4.5 MB serverless body cap — would have failed on the platform | ✅ |
| Backup/restore reworked for Postgres (`pg_dump`), restore proven into a scratch database | ✅ |
| Verified against PostgreSQL 17 locally: schema, seed, page rendering, a real edit saving, 25/25 tests | ✅ |
| Frankfurt project created and Tokyo deleted | ⛔ needs you — Supabase has no delete API and the connected account went read-only |

## Medium — worth doing soon after launch

- ✅ Analytics days are cut in Riyadh time (`REPORTING_TIMEZONE`), not UTC. Found alongside it: every `COUNT`/`SUM` aggregate came back from Postgres as a bigint *string*, so the charts were summing text — now cast in SQL.
- Vercel's Hobby plan forbids commercial use; a paid product needs Pro at $20/month.
- ✅ Bot filtering on views and interaction pings (`src/lib/bots.ts`). Crawlers, link-preview fetchers (a WhatsApp share fires one before any human opens the link) and scripted clients are served the page and not counted.
- ✅ `page_views` folded into `portfolio_events` and dropped, counts backfilled.
- ✅ Pagination on the invitations and subscriptions lists (the subscriptions one was a bare `LIMIT 100` that silently hid everything past the hundredth). Dead `listUsers` — an unbounded `SELECT * FROM users` with no callers — removed; announcements and per-customer subscription history capped.
- The client dashboard and console are Arabic-only while the public site is bilingual.
- ✅ `robots.txt` and a sitemap. The sitemap lists only portfolios that are genuinely public (published, unsuspended, owner subscribed); a withheld page and every signed-in surface carry `noindex`. Set `SITE_URL` in production or the app names itself from the request host.
- ✅ Upload hardening. `src/lib/image-info.ts` reads the real format and pixel dimensions from the header without decoding, so a 45-byte PNG declaring 40 000 × 40 000 is refused (caps: 12 000 per side, 40 MP). The parsed type is also what gets stored, so a browser's `Content-Type` claim no longer decides how an asset is served. Verified end to end through the real editor form.
- ✅ Versioned migrations: `scripts/migrate.mjs`, a `schema_migrations` table, checksums that refuse an edited migration, `--dry`, and `npm run migrate:down` for a migration that ships a `.down.sql`.
- Support tickets cannot carry attachments, which is what most real tickets need.
- ✅ Cookie notice on every page, bilingual, dismissed into `localStorage` so reading it does not itself set a cookie. A notice rather than a consent gate: both cookies (session, language) are strictly necessary and there are no advertising trackers, so a reject button could not honour itself.
- ✅ CSP now carries a per-request nonce with `'strict-dynamic'` (`src/middleware.ts`),
  so `'unsafe-inline'` is off for scripts in production — until now an injected inline
  `<script>` would have run and the script half of the policy bought nothing. Verified
  against a real production build: every inline script Next emits carries the nonce, and
  the editor, cropper, canvas export and upload all work with no console violations.
- Sign-in has no CAPTCHA or exponential backoff beyond the fixed-window limiter.

## Post-launch

- Two-factor authentication for staff (columns and session design already allow it).
- Custom domains per portfolio (`portfolios.custom_domain` is in place and unique).
- Customer data export and deletion self-service (PDPL rights).
- Payment webhooks, dunning, invoices and VAT handling.
