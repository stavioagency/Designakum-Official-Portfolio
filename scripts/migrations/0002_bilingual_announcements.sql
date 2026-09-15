-- An announcement is written by the platform owner and read by customers who may
-- not share their language. An optional English pair, empty by default, so the
-- banner falls back to the original rather than going blank.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS body_en TEXT NOT NULL DEFAULT '';
