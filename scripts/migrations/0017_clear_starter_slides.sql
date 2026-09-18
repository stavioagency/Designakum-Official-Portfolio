-- The featured images nobody asked for.
--
-- Every new portfolio was seeded with two slides that had no picture in them:
-- an accent-coloured rectangle with "Welcome" written across it. They existed
-- so the first login had something to look at, and what they actually did was
-- put placeholder text on a designer's page and leave them to find and delete
-- it twice.
--
-- This clears only the ones still untouched: no image, and the exact headline
-- and subline we wrote. A slide anybody has edited, in either language, is
-- their own and is left alone.
DELETE FROM slides
WHERE image_url = ''
  AND headline IN ('أهلاً وسهلاً بكم', 'أعمال تليق بعلامتك', 'Welcome', 'Work worthy of your brand');
