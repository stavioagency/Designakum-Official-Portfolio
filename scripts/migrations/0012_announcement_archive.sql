-- Announcements are archived, not deleted.
--
-- Deleting one destroys the record of what customers were told and when, which
-- is exactly the thing worth keeping — an announcement is a statement the
-- platform made. Archiving takes it out of the way and leaves the history.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS archived_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_announcements_archived ON announcements(archived_at, created_at DESC);
