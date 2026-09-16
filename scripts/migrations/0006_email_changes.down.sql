DROP INDEX IF EXISTS idx_email_changes_user;
DROP TABLE IF EXISTS email_changes;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
