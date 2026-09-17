DROP INDEX IF EXISTS idx_announcements_archived;
ALTER TABLE announcements DROP COLUMN IF EXISTS archived_at;
