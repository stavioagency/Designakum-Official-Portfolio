-- Two things a page owner should decide for themselves.
--
-- works_label renames the section a portfolio's items live under. "Works" is
-- right for a designer and wrong for everyone else: a restaurant has branches,
-- an agency has services, a shop has products. Empty means "use the platform's
-- word for it", translated per language, which is what every page has today.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS works_label TEXT NOT NULL DEFAULT '';

-- hide_branding is a request, not a permission. Whether the line is actually
-- hidden is decided at render time against the live subscription, so a lapsed
-- account shows it again without anything having to reach in and reset this.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS hide_branding INTEGER NOT NULL DEFAULT 0;
