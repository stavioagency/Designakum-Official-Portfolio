-- Contact buttons, instead of one hard-wired WhatsApp link.
--
-- A page could offer exactly one way to get in touch, and it had to be
-- WhatsApp. That is wrong for a studio that takes briefs by email, for a shop
-- whose customers phone, and for anyone whose next step is a booking page.
--
-- The button now carries its own kind, so the page knows how to turn the value
-- into a link and which mark to put on it. Five is the ceiling, enforced in the
-- application: past that the buttons stop being a call to action and become a
-- menu nobody reads.
CREATE TABLE IF NOT EXISTS buttons (
  seq          BIGSERIAL,
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  -- whatsapp | call | email | link
  kind         TEXT NOT NULL DEFAULT 'whatsapp',
  -- A number, an address or a URL, depending on the kind.
  value        TEXT NOT NULL DEFAULT '',
  -- Empty means the page writes the wording itself, in its own language.
  label        TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_buttons_portfolio ON buttons(portfolio_id, position, seq);

-- Everybody who had a WhatsApp number keeps their button, wording and all.
INSERT INTO buttons (id, portfolio_id, kind, value, label, position)
SELECT 'btn_' || substr(md5(p.id || p.whatsapp), 1, 18), p.id, 'whatsapp', p.whatsapp, p.whatsapp_label, 0
FROM portfolios p
WHERE p.whatsapp <> ''
ON CONFLICT (id) DO NOTHING;
