-- A page's own icon in the browser tab.
--
-- Until now every customer page carried the platform's favicon, so a designer
-- who had sent their link to a client was one tab among twenty with somebody
-- else's mark on it. The icon belongs to whoever the page is for.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '';
