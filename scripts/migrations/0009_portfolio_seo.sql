-- What a page says about itself to a search engine and to a link preview.
--
-- All optional. Empty means the page describes itself from what is already
-- there — the name and title for the heading, the bio for the description, the
-- avatar for the card — which is what every page does today and is usually
-- better than a field left half-filled.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS seo_description TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT '';
