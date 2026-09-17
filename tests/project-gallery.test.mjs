import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, db, CONNECTION_STRING } from "./helpers.mjs";

// The app modules read this for themselves; point them at the same database.
process.env.DATABASE_URL ??= CONNECTION_STRING;

const d = db();
after(async () => await closePool());

/**
 * Ordering is the whole of this feature and it fails quietly: a wrong position
 * is still a valid row, so nothing throws and the customer just finds the wrong
 * picture on their card. These drive the real functions against the real table.
 */
const { addProjectImage, moveProjectImage, removeProjectImage, imagesForProjects } =
  await import("../src/lib/project-images.ts");

async function scratch() {
  const project = await d
    .prepare(
      `SELECT pr.id, pr.portfolio_id, pr.image_url, p.user_id
         FROM projects pr JOIN portfolios p ON p.id = pr.portfolio_id
        ORDER BY pr.seq LIMIT 1`,
    )
    .get();
  assert.ok(project, "a project is needed for these");

  const user = await d.prepare("SELECT * FROM users WHERE id = ?").get(project.user_id);
  const before = await d
    .prepare("SELECT * FROM project_images WHERE project_id = ? ORDER BY position")
    .all(project.id);

  await d.prepare("DELETE FROM project_images WHERE project_id = ?").run(project.id);

  const restore = async () => {
    await d.prepare("DELETE FROM project_images WHERE project_id = ?").run(project.id);
    for (const row of before) {
      await d
        .prepare(
          `INSERT INTO project_images (id, project_id, url, width, height, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(row.id, row.project_id, row.url, row.width, row.height, row.position, row.created_at);
    }
    await d.prepare("UPDATE projects SET image_url = ? WHERE id = ?").run(project.image_url, project.id);
  };

  return { project, user, restore };
}

const urls = async (projectId) =>
  (await imagesForProjects([projectId])).get(projectId)?.map((i) => i.url) ?? [];

const cover = async (projectId) =>
  (await d.prepare("SELECT image_url FROM projects WHERE id = ?").get(projectId)).image_url;

describe("a project's images", () => {
  test("the first one added becomes the main image on the card", async () => {
    const { project, user, restore } = await scratch();
    try {
      await addProjectImage(project.id, user, { url: "/a.png", width: 800, height: 1200 });
      await addProjectImage(project.id, user, { url: "/b.png", width: 1600, height: 900 });

      assert.deepEqual(await urls(project.id), ["/a.png", "/b.png"]);
      assert.equal(await cover(project.id), "/a.png");
    } finally {
      await restore();
    }
  });

  test("making one the main image moves it to the front and updates the card", async () => {
    const { project, user, restore } = await scratch();
    try {
      await addProjectImage(project.id, user, { url: "/a.png", width: 10, height: 10 });
      await addProjectImage(project.id, user, { url: "/b.png", width: 10, height: 10 });
      await addProjectImage(project.id, user, { url: "/c.png", width: 10, height: 10 });

      const third = (await imagesForProjects([project.id])).get(project.id)[2];
      await moveProjectImage(third.id, user, 0);

      assert.deepEqual(await urls(project.id), ["/c.png", "/a.png", "/b.png"]);
      assert.equal(await cover(project.id), "/c.png", "the card still points at the old main image");
    } finally {
      await restore();
    }
  });

  test("positions stay 0,1,2 with no gaps after a delete", async () => {
    const { project, user, restore } = await scratch();
    try {
      for (const url of ["/a.png", "/b.png", "/c.png"]) {
        await addProjectImage(project.id, user, { url, width: 10, height: 10 });
      }
      const list = (await imagesForProjects([project.id])).get(project.id);
      await removeProjectImage(list[1].id, user);

      const after = (await imagesForProjects([project.id])).get(project.id);
      assert.deepEqual(after.map((i) => i.position), [0, 1]);
      assert.deepEqual(after.map((i) => i.url), ["/a.png", "/c.png"]);
    } finally {
      await restore();
    }
  });

  test("deleting the main image promotes the next one onto the card", async () => {
    const { project, user, restore } = await scratch();
    try {
      await addProjectImage(project.id, user, { url: "/a.png", width: 10, height: 10 });
      await addProjectImage(project.id, user, { url: "/b.png", width: 10, height: 10 });

      const list = (await imagesForProjects([project.id])).get(project.id);
      await removeProjectImage(list[0].id, user);

      assert.equal(await cover(project.id), "/b.png");
    } finally {
      await restore();
    }
  });

  test("deleting the last image leaves the card with nothing rather than a dead link", async () => {
    const { project, user, restore } = await scratch();
    try {
      await addProjectImage(project.id, user, { url: "/only.png", width: 10, height: 10 });
      const list = (await imagesForProjects([project.id])).get(project.id);
      await removeProjectImage(list[0].id, user);

      assert.equal(await cover(project.id), "");
    } finally {
      await restore();
    }
  });

  test("the real dimensions are kept, so the page can use them", async () => {
    const { project, user, restore } = await scratch();
    try {
      await addProjectImage(project.id, user, { url: "/tall.png", width: 900, height: 1600 });
      const [image] = (await imagesForProjects([project.id])).get(project.id);
      assert.equal(image.width, 900);
      assert.equal(image.height, 1600);
    } finally {
      await restore();
    }
  });
});
