import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { assertCanEdit } from "./portfolios";
import type { User } from "./types";

/**
 * The images belonging to one project.
 *
 * Position 0 is the main one: the picture on the card, the one a visitor sees
 * before opening anything. It is a position rather than a flag so that "make
 * this the main image" and "reorder" are the same operation, and so there can
 * never be two main images or none.
 *
 * `projects.image_url` is kept in step with position 0. It is a copy, and a
 * copy is a thing that can drift, but it is read by the card, the sitemap and
 * the share image, and those paths should not each have to join a second table
 * to find one URL.
 */

export interface ProjectImage {
  id: string;
  project_id: string;
  url: string;
  width: number;
  height: number;
  position: number;
}

/** Every image for the given projects, in order, keyed by project. */
export async function imagesForProjects(
  projectIds: string[],
): Promise<Map<string, ProjectImage[]>> {
  const grouped = new Map<string, ProjectImage[]>();
  if (!projectIds.length) return grouped;

  const rows = await all<ProjectImage>(
    `SELECT id, project_id, url, width, height, position
       FROM project_images
      WHERE project_id IN (${projectIds.map(() => "?").join(", ")})
      ORDER BY position, seq`,
    ...projectIds,
  );

  for (const row of rows) {
    const list = grouped.get(row.project_id);
    if (list) list.push(row);
    else grouped.set(row.project_id, [row]);
  }
  return grouped;
}

async function ownerOf(projectId: string) {
  return await get<{ portfolio_id: string }>(
    "SELECT portfolio_id FROM projects WHERE id = ?",
    projectId,
  );
}

/**
 * Renumbers from zero and copies the new first image onto the project.
 *
 * Called after every change rather than trying to patch positions in place:
 * the list is small, and an ordering that is rewritten from scratch cannot
 * develop gaps, duplicates, or a project whose card points at an image that was
 * deleted ten minutes ago.
 */
async function resettle(projectId: string) {
  const rows = await all<{ id: string; url: string }>(
    "SELECT id, url FROM project_images WHERE project_id = ? ORDER BY position, seq",
    projectId,
  );

  for (const [index, row] of rows.entries()) {
    await run("UPDATE project_images SET position = ? WHERE id = ?", index, row.id);
  }

  await run("UPDATE projects SET image_url = ? WHERE id = ?", rows[0]?.url ?? "", projectId);
}

export async function addProjectImage(
  projectId: string,
  user: User,
  image: { url: string; width: number; height: number },
): Promise<void> {
  const project = await ownerOf(projectId);
  if (!project) return;
  await assertCanEdit(project.portfolio_id, user);

  const last = await get<{ n: number }>(
    "SELECT COALESCE(MAX(position), -1) AS n FROM project_images WHERE project_id = ?",
    projectId,
  );

  await run(
    `INSERT INTO project_images (id, project_id, url, width, height, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId("pim"),
    projectId,
    image.url,
    image.width,
    image.height,
    (last?.n ?? -1) + 1,
    now(),
  );
  await resettle(projectId);
}

export async function removeProjectImage(imageId: string, user: User): Promise<void> {
  const row = await get<{ project_id: string; portfolio_id: string }>(
    `SELECT i.project_id, p.portfolio_id
       FROM project_images i JOIN projects p ON p.id = i.project_id
      WHERE i.id = ?`,
    imageId,
  );
  if (!row) return;
  await assertCanEdit(row.portfolio_id, user);

  await run("DELETE FROM project_images WHERE id = ?", imageId);
  await resettle(row.project_id);
}

/**
 * Moves one image within its project.
 *
 * `to` is clamped rather than rejected, so "make this the main image" is just a
 * move to zero and the last image cannot be moved off the end of the list.
 */
export async function moveProjectImage(imageId: string, user: User, to: number): Promise<void> {
  const row = await get<{ project_id: string; portfolio_id: string; position: number }>(
    `SELECT i.project_id, i.position, p.portfolio_id
       FROM project_images i JOIN projects p ON p.id = i.project_id
      WHERE i.id = ?`,
    imageId,
  );
  if (!row) return;
  await assertCanEdit(row.portfolio_id, user);

  const rows = await all<{ id: string }>(
    "SELECT id FROM project_images WHERE project_id = ? ORDER BY position, seq",
    row.project_id,
  );
  const from = rows.findIndex((r) => r.id === imageId);
  if (from < 0) return;

  const target = Math.min(Math.max(0, to), rows.length - 1);
  if (target === from) return;

  const [moved] = rows.splice(from, 1);
  rows.splice(target, 0, moved);

  for (const [index, r] of rows.entries()) {
    // Offset first, so two rows never hold the same position mid-flight.
    await run("UPDATE project_images SET position = ? WHERE id = ?", index + 1000, r.id);
  }
  await resettle(row.project_id);
}
