-- Whether this person has been shown around the studio.
--
-- On the account rather than in the browser: a customer who sets their page up
-- on a laptop and opens it later on a phone has already had the tour, and being
-- walked through it again is the software forgetting them. Null means never.
ALTER TABLE users ADD COLUMN IF NOT EXISTS toured_at BIGINT;
