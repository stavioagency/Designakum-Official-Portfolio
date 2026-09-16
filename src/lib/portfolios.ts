import "server-only";
import { DEFAULT_LOCALE, dict } from "./i18n";
import { messages } from "./locale";
import type { Locale } from "./types";
import { all, get, now, run } from "./db";
import { newId, slugify } from "./ids";
import { dayKey, markUniqueVisitor, recordPortfolioEvent } from "./analytics";
import { DEFAULT_THEME } from "./types";
import type {
  Portfolio,
  PortfolioBundle,
  Project,
  Slide,
  Social,
  Stat,
  User,
} from "./types";

export class TenantError extends Error {}

/* ------------------------------------------------------------------ retrieval */

export async function getPortfolioBySlug(slug: string) {
  return await get<Portfolio>("SELECT * FROM portfolios WHERE slug = ?", slug);
}

export async function getPortfolioById(id: string) {
  return await get<Portfolio>("SELECT * FROM portfolios WHERE id = ?", id);
}

export async function getPortfolioForUser(userId: string) {
  return await get<Portfolio>(
    "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
    userId,
  );
}

export async function listPortfolios() {
  return await all<Portfolio & { email: string; owner_status: string }>(
    `SELECT p.*, u.email AS email, u.status AS owner_status
       FROM portfolios p JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC`,
  );
}

export async function loadBundle(portfolio: Portfolio): Promise<PortfolioBundle>{
  return {
    portfolio,
    slides: await all<Slide>(
      "SELECT * FROM slides WHERE portfolio_id = ? ORDER BY position, seq",
      portfolio.id,
    ),
    projects: await all<Project>(
      "SELECT * FROM projects WHERE portfolio_id = ? ORDER BY position, seq",
      portfolio.id,
    ),
    stats: await all<Stat>(
      "SELECT * FROM stats WHERE portfolio_id = ? ORDER BY position, seq",
      portfolio.id,
    ),
    socials: await all<Social>(
      "SELECT * FROM socials WHERE portfolio_id = ? ORDER BY position, seq",
      portfolio.id,
    ),
  };
}

/* ------------------------------------------------------------------ isolation */

/**
 * The single gate every mutation passes through. A client may only ever touch a
 * portfolio row whose `user_id` equals their own id; the platform owner may touch any.
 * Every child-table statement additionally scopes by `portfolio_id`, so a forged
 * child id from another tenant matches zero rows instead of leaking across accounts.
 */
export async function assertCanEdit(portfolioId: string, user: User): Promise<Portfolio>{
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) throw new TenantError((await messages()).portfolioNotFound);
  if (user.role !== "owner" && portfolio.user_id !== user.id) {
    throw new TenantError((await messages()).notYourPortfolio);
  }
  return portfolio;
}

async function touch(portfolioId: string) {
  await run("UPDATE portfolios SET updated_at = ? WHERE id = ?", now(), portfolioId);
}

/* ------------------------------------------------------------------- creation */

export async function uniqueSlug(desired: string): Promise<string>{
  const base = slugify(desired) || "portfolio";
  let candidate = base;
  let n = 2;
  while (await get("SELECT id FROM portfolios WHERE slug = ?", candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

export async function createPortfolio(input: {
  userId: string;
  slug?: string;
  name: string;
  title?: string;
  locale?: Locale;
}): Promise<Portfolio>{
  const ts = now();
  const locale = input.locale ?? DEFAULT_LOCALE;
  const d = dict(locale).portfolio;
  const id = newId("pf");
  const slug = await uniqueSlug(input.slug || input.name);
  await run(
    `INSERT INTO portfolios
       (id, user_id, slug, name, title, tagline, bio, monogram, whatsapp_label, theme, locale, footer_note, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    input.userId,
    slug,
    input.name,
    input.title ?? "",
    input.name.trim().charAt(0).toUpperCase(),
    d.whatsapp,
    DEFAULT_THEME,
    locale,
    `${d.rights} — ${input.name}`,
    ts,
    ts,
  );
  return (await getPortfolioById(id))!;
}

/* ------------------------------------------------------------------ portfolio */

const PROFILE_FIELDS = [
  "name",
  "title",
  "tagline",
  "bio",
  "avatar_url",
  "monogram",
  "whatsapp",
  "whatsapp_label",
  "theme",
  "footer_note",
] as const;

export async function updateProfile(
  portfolioId: string,
  user: User,
  patch: Partial<Record<(typeof PROFILE_FIELDS)[number], string>>,
) {
  await assertCanEdit(portfolioId, user);
  const entries = PROFILE_FIELDS.filter((f) => patch[f] !== undefined).map(
    (f) => [f, patch[f]!] as const,
  );
  if (!entries.length) return;
  const sql = `UPDATE portfolios SET ${entries
    .map(([f]) => `${f} = ?`)
    .join(", ")}, updated_at = ? WHERE id = ?`;
  await run(sql, ...entries.map(([, v]) => v), now(), portfolioId);
}

export async function updateSlug(portfolioId: string, user: User, desired: string) {
  const portfolio = await assertCanEdit(portfolioId, user);
  const slug = slugify(desired);
  if (!slug) throw new TenantError((await messages()).badSlug);
  const clash = await get<{ id: string }>("SELECT id FROM portfolios WHERE slug = ?", slug);
  if (clash && clash.id !== portfolio.id) {
    throw new TenantError((await messages()).slugTaken);
  }
  await run("UPDATE portfolios SET slug = ?, updated_at = ? WHERE id = ?", slug, now(), portfolioId);
  return slug;
}

export async function setPublished(portfolioId: string, user: User, published: boolean) {
  await assertCanEdit(portfolioId, user);
  await run(
    "UPDATE portfolios SET published = ?, updated_at = ? WHERE id = ?",
    published ? 1 : 0,
    now(),
    portfolioId,
  );
}

export async function recordView(portfolioId: string, visitorHash?: string) {
  const day = dayKey();
  await run("UPDATE portfolios SET views = views + 1 WHERE id = ?", portfolioId);
  await recordPortfolioEvent(portfolioId, "view", day);
  if (visitorHash) await markUniqueVisitor(portfolioId, visitorHash, day);
}

export async function viewsByDay(portfolioId: string, days = 14) {
  return (await all<{ day: string; count: number }>(
    `SELECT day, count::int AS count FROM portfolio_events
      WHERE portfolio_id = ? AND kind = 'view' ORDER BY day DESC LIMIT ?`,
    portfolioId,
    days,
  )).reverse();
}

/* --------------------------------------------------------------- child tables */

type ChildTable = "slides" | "projects" | "stats" | "socials";

const COLUMNS: Record<ChildTable, string[]> = {
  slides: ["image_url", "headline", "subline", "caption"],
  projects: ["title", "category", "description", "image_url", "link"],
  stats: ["label", "value", "icon"],
  socials: ["platform", "url"],
};

const PREFIX: Record<ChildTable, string> = {
  slides: "sld",
  projects: "prj",
  stats: "stt",
  socials: "soc",
};

export async function addChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  values: Record<string, string> = {},
) {
  await assertCanEdit(portfolioId, user);
  const cols = COLUMNS[table];
  const id = newId(PREFIX[table]);
  const next =
    ((await get<{ n: number | null }>(
      `SELECT MAX(position) AS n FROM ${table} WHERE portfolio_id = ?`,
      portfolioId,
    ))?.n ?? -1) + 1;
  await run(
    `INSERT INTO ${table} (id, portfolio_id, position, ${cols.join(", ")})
     VALUES (?, ?, ?, ${cols.map(() => "?").join(", ")})`,
    id,
    portfolioId,
    next,
    ...cols.map((c) => values[c] ?? ""),
  );
  await touch(portfolioId);
  return id;
}

export async function updateChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
  values: Record<string, string>,
) {
  await assertCanEdit(portfolioId, user);
  const cols = COLUMNS[table].filter((c) => values[c] !== undefined);
  if (!cols.length) return;
  await run(
    `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}
      WHERE id = ? AND portfolio_id = ?`,
    ...cols.map((c) => values[c]!),
    childId,
    portfolioId,
  );
  await touch(portfolioId);
}

export async function deleteChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
) {
  await assertCanEdit(portfolioId, user);
  await run(`DELETE FROM ${table} WHERE id = ? AND portfolio_id = ?`, childId, portfolioId);
  await touch(portfolioId);
}

export async function moveChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
  direction: "up" | "down",
) {
  await assertCanEdit(portfolioId, user);
  const rows = await all<{ id: string }>(
    `SELECT id FROM ${table} WHERE portfolio_id = ? ORDER BY position, seq`,
    portfolioId,
  );
  const index = rows.findIndex((r) => r.id === childId);
  if (index < 0) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  rows.forEach(async (row, i) =>
    await run(`UPDATE ${table} SET position = ? WHERE id = ? AND portfolio_id = ?`, i, row.id, portfolioId),
  );
  await touch(portfolioId);
}
