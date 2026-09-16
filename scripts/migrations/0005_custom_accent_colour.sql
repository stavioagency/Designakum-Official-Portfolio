-- A portfolio may carry its own accent colour instead of one of the seven.
--
-- Empty means "use the theme", which is what every existing row wants — so this
-- needs no backfill and changes nothing about a page that has not asked for it.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS accent_hex TEXT NOT NULL DEFAULT '';
