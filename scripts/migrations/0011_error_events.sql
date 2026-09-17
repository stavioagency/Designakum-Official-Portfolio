-- Failures, kept where somebody will see them.
--
-- Every handled error was written to stderr and nothing read it: a payment
-- webhook failing at 3am looked exactly like silence until a customer wrote in.
--
-- Grouped by fingerprint rather than stored one row per occurrence. The same
-- fault firing a thousand times is one problem, and a table that grows a row
-- per request during an outage is a second problem arriving on top of the
-- first.
CREATE TABLE IF NOT EXISTS error_events (
  fingerprint TEXT PRIMARY KEY,
  area        TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  stack       TEXT NOT NULL DEFAULT '',
  context     TEXT NOT NULL DEFAULT '',
  count       BIGINT NOT NULL DEFAULT 1,
  first_seen  BIGINT NOT NULL,
  last_seen   BIGINT NOT NULL,
  notified_at BIGINT,
  resolved_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_error_events_open ON error_events(resolved_at, last_seen DESC);
