import "server-only";
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

export function getPortfolioBySlug(slug: string) {
  return get<Portfolio>("SELECT * FROM portfolios WHERE slug = ?", slug);
}

export function getPortfolioById(id: string) {
  return get<Portfolio>("SELECT * FROM portfolios WHERE id = ?", id);
}

export function getPortfolioForUser(userId: string) {
  return get<Portfolio>(
    "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
    userId,
  );
}

export function listPortfolios() {
  return all<Portfolio & { email: string; owner_status: string }>(
    `SELECT p.*, u.email AS email, u.status AS owner_status
       FROM portfolios p JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC`,
  );
}

export function loadBundle(portfolio: Portfolio): PortfolioBundle {
  return {
    portfolio,
    slides: all<Slide>(
      "SELECT * FROM slides WHERE portfolio_id = ? ORDER BY position, rowid",
      portfolio.id,
    ),
    projects: all<Project>(
      "SELECT * FROM projects WHERE portfolio_id = ? ORDER BY position, rowid",
      portfolio.id,
    ),
    stats: all<Stat>(
      "SELECT * FROM stats WHERE portfolio_id = ? ORDER BY position, rowid",
      portfolio.id,
    ),
    socials: all<Social>(
      "SELECT * FROM socials WHERE portfolio_id = ? ORDER BY position, rowid",
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
export function assertCanEdit(portfolioId: string, user: User): Portfolio {
  const portfolio = getPortfolioById(portfolioId);
  if (!portfolio) throw new TenantError("لم يتم العثور على المعرض");
  if (user.role !== "owner" && portfolio.user_id !== user.id) {
    throw new TenantError("لا تملك صلاحية تعديل هذا المعرض");
  }
  return portfolio;
}

function touch(portfolioId: string) {
  run("UPDATE portfolios SET updated_at = ? WHERE id = ?", now(), portfolioId);
}

/* ------------------------------------------------------------------- creation */

export function uniqueSlug(desired: string): string {
  const base = slugify(desired) || "portfolio";
  let candidate = base;
  let n = 2;
  while (get("SELECT id FROM portfolios WHERE slug = ?", candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

export function createPortfolio(input: {
  userId: string;
  slug?: string;
  name: string;
  title?: string;
}): Portfolio {
  const ts = now();
  const id = newId("pf");
  const slug = uniqueSlug(input.slug || input.name);
  run(
    `INSERT INTO portfolios
       (id, user_id, slug, name, title, tagline, bio, monogram, whatsapp_label, theme, locale, footer_note, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', '', ?, 'تواصل معي عبر واتساب', ?, 'ar', ?, 0, ?, ?)`,
    id,
    input.userId,
    slug,
    input.name,
    input.title ?? "",
    input.name.trim().charAt(0).toUpperCase(),
    DEFAULT_THEME,
    `جميع الحقوق محفوظة لـ ${input.name}`,
    ts,
    ts,
  );
  return getPortfolioById(id)!;
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

export function updateProfile(
  portfolioId: string,
  user: User,
  patch: Partial<Record<(typeof PROFILE_FIELDS)[number], string>>,
) {
  assertCanEdit(portfolioId, user);
  const entries = PROFILE_FIELDS.filter((f) => patch[f] !== undefined).map(
    (f) => [f, patch[f]!] as const,
  );
  if (!entries.length) return;
  const sql = `UPDATE portfolios SET ${entries
    .map(([f]) => `${f} = ?`)
    .join(", ")}, updated_at = ? WHERE id = ?`;
  run(sql, ...entries.map(([, v]) => v), now(), portfolioId);
}

export function updateSlug(portfolioId: string, user: User, desired: string) {
  const portfolio = assertCanEdit(portfolioId, user);
  const slug = slugify(desired);
  if (!slug) throw new TenantError("الرابط غير صالح");
  const clash = get<{ id: string }>("SELECT id FROM portfolios WHERE slug = ?", slug);
  if (clash && clash.id !== portfolio.id) throw new TenantError("هذا الرابط محجوز، جرّب رابطًا آخر");
  run("UPDATE portfolios SET slug = ?, updated_at = ? WHERE id = ?", slug, now(), portfolioId);
  return slug;
}

export function setPublished(portfolioId: string, user: User, published: boolean) {
  assertCanEdit(portfolioId, user);
  run(
    "UPDATE portfolios SET published = ?, updated_at = ? WHERE id = ?",
    published ? 1 : 0,
    now(),
    portfolioId,
  );
}

export function recordView(portfolioId: string, visitorHash?: string) {
  const day = dayKey();
  run("UPDATE portfolios SET views = views + 1 WHERE id = ?", portfolioId);
  run(
    `INSERT INTO page_views (id, portfolio_id, day, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(portfolio_id, day) DO UPDATE SET count = count + 1`,
    newId("pv"),
    portfolioId,
    day,
  );
  recordPortfolioEvent(portfolioId, "view", day);
  if (visitorHash) markUniqueVisitor(portfolioId, visitorHash, day);
}

export function viewsByDay(portfolioId: string, days = 14) {
  return all<{ day: string; count: number }>(
    "SELECT day, count FROM page_views WHERE portfolio_id = ? ORDER BY day DESC LIMIT ?",
    portfolioId,
    days,
  ).reverse();
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

export function addChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  values: Record<string, string> = {},
) {
  assertCanEdit(portfolioId, user);
  const cols = COLUMNS[table];
  const id = newId(PREFIX[table]);
  const next =
    (get<{ n: number | null }>(
      `SELECT MAX(position) AS n FROM ${table} WHERE portfolio_id = ?`,
      portfolioId,
    )?.n ?? -1) + 1;
  run(
    `INSERT INTO ${table} (id, portfolio_id, position, ${cols.join(", ")})
     VALUES (?, ?, ?, ${cols.map(() => "?").join(", ")})`,
    id,
    portfolioId,
    next,
    ...cols.map((c) => values[c] ?? ""),
  );
  touch(portfolioId);
  return id;
}

export function updateChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
  values: Record<string, string>,
) {
  assertCanEdit(portfolioId, user);
  const cols = COLUMNS[table].filter((c) => values[c] !== undefined);
  if (!cols.length) return;
  run(
    `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}
      WHERE id = ? AND portfolio_id = ?`,
    ...cols.map((c) => values[c]!),
    childId,
    portfolioId,
  );
  touch(portfolioId);
}

export function deleteChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
) {
  assertCanEdit(portfolioId, user);
  run(`DELETE FROM ${table} WHERE id = ? AND portfolio_id = ?`, childId, portfolioId);
  touch(portfolioId);
}

export function moveChild(
  table: ChildTable,
  portfolioId: string,
  user: User,
  childId: string,
  direction: "up" | "down",
) {
  assertCanEdit(portfolioId, user);
  const rows = all<{ id: string }>(
    `SELECT id FROM ${table} WHERE portfolio_id = ? ORDER BY position, rowid`,
    portfolioId,
  );
  const index = rows.findIndex((r) => r.id === childId);
  if (index < 0) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  rows.forEach((row, i) =>
    run(`UPDATE ${table} SET position = ? WHERE id = ? AND portfolio_id = ?`, i, row.id, portfolioId),
  );
  touch(portfolioId);
}
