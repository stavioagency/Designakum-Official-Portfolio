-- A background colour of the customer's choosing.
--
-- Empty means "the platform's own dark ground", which is what every existing
-- portfolio has and what the column defaults to, so nothing changes appearance
-- until someone picks something. The derived surfaces and text tones are
-- computed from this at render time rather than stored: they are a function of
-- this one value, and storing them would let the two drift apart.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS background_hex TEXT NOT NULL DEFAULT '';
