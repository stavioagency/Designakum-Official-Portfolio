-- Google sign-in hands us an email and a name but never a portfolio link, so the
-- account used to be given a generated one silently. This column marks whether a
-- customer has been through the step where they choose it themselves.
--
-- Existing accounts are backfilled as already onboarded: they have a link they
-- have been using, and bouncing them into a "choose your link" screen would be a
-- worse surprise than the one this step exists to prevent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at BIGINT;

UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;
