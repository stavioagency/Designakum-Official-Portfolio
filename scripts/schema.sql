PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
-- Without this a writer that meets a concurrent writer fails immediately with
-- SQLITE_BUSY instead of waiting its turn.
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'client',   -- 'owner' | 'support' | 'client'
  status        TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'suspended'
  plan          TEXT NOT NULL DEFAULT 'free',     -- 'free' | 'monthly' | 'yearly'
  two_factor_secret TEXT NOT NULL DEFAULT '',
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  last_seen_at  INTEGER,
  google_id     TEXT,
  avatar_url    TEXT NOT NULL DEFAULT '',
  auth_provider TEXT NOT NULL DEFAULT 'password',  -- 'password' | 'google'
  locale        TEXT NOT NULL DEFAULT 'ar',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolios (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL UNIQUE,
  custom_domain  TEXT UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  title          TEXT NOT NULL DEFAULT '',
  tagline        TEXT NOT NULL DEFAULT '',
  bio            TEXT NOT NULL DEFAULT '',
  avatar_url     TEXT NOT NULL DEFAULT '',
  monogram       TEXT NOT NULL DEFAULT '',
  whatsapp       TEXT NOT NULL DEFAULT '',
  whatsapp_label TEXT NOT NULL DEFAULT 'تواصل معي عبر واتساب',
  theme          TEXT NOT NULL DEFAULT 'violet',
  locale         TEXT NOT NULL DEFAULT 'ar',
  footer_note    TEXT NOT NULL DEFAULT '',
  published      INTEGER NOT NULL DEFAULT 0,
  suspended      INTEGER NOT NULL DEFAULT 0,
  suspended_reason TEXT NOT NULL DEFAULT '',
  suspended_at   INTEGER,
  suspended_until INTEGER,
  views          INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);

CREATE TABLE IF NOT EXISTS slides (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL DEFAULT '',
  headline     TEXT NOT NULL DEFAULT '',
  subline      TEXT NOT NULL DEFAULT '',
  caption      TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_slides_portfolio ON slides(portfolio_id, position);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  image_url    TEXT NOT NULL DEFAULT '',
  link         TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_projects_portfolio ON projects(portfolio_id, position);

CREATE TABLE IF NOT EXISTS stats (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT '',
  value        TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stats_portfolio ON stats(portfolio_id, position);

CREATE TABLE IF NOT EXISTS socials (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL DEFAULT 'link',
  url          TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_socials_portfolio ON socials(portfolio_id, position);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS assets (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime         TEXT NOT NULL,
  bytes        BLOB NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id);

CREATE TABLE IF NOT EXISTS page_views (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(portfolio_id, day)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                     TEXT NOT NULL,              -- 'monthly' | 'yearly'
  status                   TEXT NOT NULL,              -- 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete'
  provider                 TEXT NOT NULL DEFAULT 'manual',
  provider_customer_id     TEXT,
  provider_subscription_id TEXT,
  amount                   INTEGER NOT NULL DEFAULT 0,   -- halalas actually billed; 0 for comped
  source                   TEXT NOT NULL DEFAULT 'paid', -- paid | manual | invitation
  started_at               INTEGER,
  canceled_at              INTEGER,
  current_period_end       INTEGER,
  cancel_at_period_end     INTEGER NOT NULL DEFAULT 0,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, created_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  verifier   TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_events (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id, created_at);

/* ------------------------------------------------------------------ console */

CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  actor_id     TEXT,
  actor_email  TEXT NOT NULL DEFAULT '',
  actor_role   TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL DEFAULT '',
  target_id    TEXT NOT NULL DEFAULT '',
  target_label TEXT NOT NULL DEFAULT '',
  before_state TEXT NOT NULL DEFAULT '',
  after_state  TEXT NOT NULL DEFAULT '',
  detail       TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  portfolio_id  TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  reporter_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  reporter_email TEXT NOT NULL DEFAULT '',
  reason        TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  evidence_url  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | reviewing | resolved | dismissed
  assignee_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution    TEXT NOT NULL DEFAULT '',
  resolved_at   INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_portfolio ON reports(portfolio_id);

CREATE TABLE IF NOT EXISTS report_notes (
  id         TEXT PRIMARY KEY,
  report_id  TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_notes ON report_notes(report_id, created_at);

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  priority    TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high | urgent
  status      TEXT NOT NULL DEFAULT 'open',     -- open | in_progress | waiting_customer | resolved
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_reply_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, last_reply_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, created_at);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_side TEXT NOT NULL DEFAULT 'customer',  -- customer | staff
  body        TEXT NOT NULL,
  internal    INTEGER NOT NULL DEFAULT 0,        -- staff-only note, never shown to the customer
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages ON ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS invitations (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  plan         TEXT NOT NULL DEFAULT 'monthly',
  months       INTEGER NOT NULL DEFAULT 1,
  email        TEXT NOT NULL DEFAULT '',
  max_uses     INTEGER NOT NULL DEFAULT 1,
  used_count   INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER,
  note         TEXT NOT NULL DEFAULT '',
  revoked      INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);

CREATE TABLE IF NOT EXISTS invitation_redemptions (
  id            TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redemptions ON invitation_redemptions(invitation_id, created_at);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  severity   TEXT NOT NULL DEFAULT 'info',   -- info | success | warning | critical
  active     INTEGER NOT NULL DEFAULT 1,
  starts_at  INTEGER,
  ends_at    INTEGER,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, starts_at);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS portfolio_events (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,          -- view | whatsapp | social | project
  day          TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(portfolio_id, kind, day)
);
CREATE INDEX IF NOT EXISTS idx_portfolio_events_day ON portfolio_events(day, kind);

CREATE TABLE IF NOT EXISTS visit_marks (
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (portfolio_id, day, visitor_hash)
);
CREATE INDEX IF NOT EXISTS idx_visit_marks_day ON visit_marks(day);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, created_at);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id         TEXT PRIMARY KEY,
  recipient  TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'transactional',
  delivered  INTEGER NOT NULL DEFAULT 0,
  error      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_created ON mail_outbox(created_at);
