-- One-time codes for getting back in when the authenticator is gone.
--
-- Without these, turning on two-factor is a way to lose an account rather than
-- protect one, and for the last remaining owner it is a way to lose the
-- platform. Stored hashed, like any other credential: the console shows them
-- once at enrolment and cannot show them again.
CREATE TABLE IF NOT EXISTS two_factor_recovery (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_two_factor_recovery_user
  ON two_factor_recovery(user_id, used_at);
