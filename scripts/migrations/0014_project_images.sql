-- More than one image per project.
--
-- A project was a single picture, which is not what a portfolio piece is: a
-- brand identity is a logo, then the type, then it applied to something. The
-- first image stays the one shown on the card, and the rest belong to the
-- project.
--
-- Width and height are stored with each image because they decide how it is
-- displayed. Forcing every picture into the same rectangle crops somebody's
-- work to fit a layout, so the page reads the real dimensions and gives each
-- image its own shape. They are read from the file's header at upload; zero
-- means we do not know, and the page falls back to a sensible box.
CREATE TABLE IF NOT EXISTS project_images (
  seq        BIGSERIAL,
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_images ON project_images(project_id, position, seq);

-- Every project that already has a picture keeps it, as its first image.
INSERT INTO project_images (id, project_id, url, position, created_at)
SELECT 'pim_' || substr(md5(p.id || p.image_url), 1, 18), p.id, p.image_url, 0,
       (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT
FROM projects p
WHERE p.image_url <> ''
ON CONFLICT (id) DO NOTHING;
