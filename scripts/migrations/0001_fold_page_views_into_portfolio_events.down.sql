-- Recreates the table and copies the view rows back. Any row that only ever
-- existed in portfolio_events comes back too, which is the safe direction.
CREATE TABLE IF NOT EXISTS page_views (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  count        BIGINT NOT NULL DEFAULT 0,
  UNIQUE(portfolio_id, day)
);

INSERT INTO page_views (id, portfolio_id, day, count)
SELECT 'pv_' || id, portfolio_id, day, count
  FROM portfolio_events WHERE kind = 'view'
    ON CONFLICT (portfolio_id, day) DO NOTHING;
