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

## Medium — worth doing soon after launch

- Analytics days are cut on UTC, not Riyadh time, so "today" ends at 3am locally.
- No bot filtering on portfolio views; crawlers inflate a designer's numbers.
- `page_views` and `portfolio_events` both record views — one should go.
- `listInvitations` and the subscription list have no pagination.
- The client dashboard and console are Arabic-only while the public site is bilingual.
- No `robots.txt` or sitemap, which matters for a portfolio platform's SEO.
- Upload hardening: no image dimension cap, so a decompression bomb is possible.
- Column migrations are ad hoc with no version table and no rollback path.
- Support tickets cannot carry attachments, which is what most real tickets need.
- No cookie/consent notice (PDPL).
- CSP still allows `'unsafe-inline'` for scripts; tightening to per-request nonces
  needs a middleware and is worth doing once the app is stable.
- Sign-in has no CAPTCHA or exponential backoff beyond the fixed-window limiter.

## Post-launch

- Two-factor authentication for staff (columns and session design already allow it).
- Custom domains per portfolio (`portfolios.custom_domain` is in place and unique).
- Object storage for images instead of database blobs, once volume justifies it.
- Customer data export and deletion self-service (PDPL rights).
- Payment webhooks, dunning, invoices and VAT handling.
- Moving from SQLite to Postgres when a second app instance is needed.
