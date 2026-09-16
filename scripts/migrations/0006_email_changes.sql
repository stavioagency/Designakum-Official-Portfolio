-- Changing the address you sign in with.
--
-- The new address is parked here until it is proven, never written straight to
-- users.email: an unproven change would let someone point their account at an
-- address they do not own, and the Google callback links an identity to whatever
-- account already holds that email.
CREATE TABLE IF NOT EXISTS email_changes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email  TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at    BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_changes_user ON email_changes(user_id, created_at DESC);

-- When the address was last proven by someone opening a link sent to it. NULL
-- for every account that predates this, which is the honest answer: none of
-- them ever confirmed anything.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at BIGINT;
