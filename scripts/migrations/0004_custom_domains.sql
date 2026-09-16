-- A customer pointing their own domain at their portfolio.
--
-- One row per hostname, and a hostname belongs to exactly one portfolio — the
-- UNIQUE constraint is what stops two customers claiming the same name, and it
-- is enforced by the database rather than by a check in the action, because the
-- check loses that race and the constraint does not.
--
-- `verify_token` is the value the customer publishes as a TXT record. It proves
-- they control the name; without it anyone could point a domain they do not own
-- at someone else's portfolio and collect their traffic.
CREATE TABLE IF NOT EXISTS domains (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  hostname     TEXT NOT NULL UNIQUE,            -- always lower case, no port, no trailing dot
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | active | failed
  verify_token TEXT NOT NULL,
  last_error   TEXT NOT NULL DEFAULT '',
  checked_at   BIGINT,
  verified_at  BIGINT,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS domains_portfolio_idx ON domains (portfolio_id);
CREATE INDEX IF NOT EXISTS domains_active_idx ON domains (hostname) WHERE status = 'active';
