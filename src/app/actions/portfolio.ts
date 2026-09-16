"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { storeImage } from "@/lib/assets";
import { canPublish } from "@/lib/billing";
import { isSafeUrl, socialHref } from "@/lib/safe-url";
import { all } from "@/lib/db";
import {
  TenantError,
  addChild,
  assertCanEdit,
  deleteChild,
  moveChild,
  setPublished,
  updateChild,
  updateProfile,
  updateSlug,
} from "@/lib/portfolios";
import { THEMES, type ThemeKey, type User } from "@/lib/types";
import { reportError } from "@/lib/observability";

export type ActionState = { ok?: string; error?: string } | null;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

type ChildTable = "slides" | "projects" | "stats" | "socials";
const TABLES: ChildTable[] = ["slides", "projects", "stats", "socials"];

function table(fd: FormData): ChildTable {
  const t = str(fd, "table") as ChildTable;
  if (!TABLES.includes(t)) throw new Error("unknown table");
  return t;
}

/** Revalidate both the editor and the public page the edit affects. */
function refresh(slug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/preview");
  revalidatePath(`/p/${slug}`);
}

async function withPortfolio(fd: FormData): Promise<{ user: User; id: string; slug: string }> {
  const user = await requireUser();
  const id = str(fd, "portfolioId");
  const portfolio = await assertCanEdit(id, user);
  return { user, id, slug: portfolio.slug };
}

/**
 * Resolves an image field to its new value: a freshly uploaded file, an explicit
 * removal, or `undefined` meaning "leave whatever is already stored alone".
 */
async function resolveImage(
  fd: FormData,
  field: string,
  user: User,
): Promise<string | undefined> {
  const file = fd.get(field);
  if (file instanceof File && file.size > 0) return await storeImage(file, user);
  if (str(fd, `${field}_cleared`) === "1") return "";
  return undefined;
}

async function fail(error: unknown): Promise<ActionState> {
  // A tenant error already carries a sentence meant for the person who caused it.
  if (error instanceof TenantError) return { error: error.message };
  reportError(error, { area: "portfolio" });
  const m = await messages();
  return { error: error instanceof Error ? error.message : m.saveFailed };
}

/* -------------------------------------------------------------------- profile */

export async function saveProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const avatar = await resolveImage(fd, "avatar", user);
    const theme = str(fd, "theme");
    if (!(theme in THEMES)) return { error: (await messages()).unknownTheme };

    await updateProfile(id, user, {
      name: str(fd, "name"),
      title: str(fd, "title"),
      tagline: str(fd, "tagline"),
      bio: str(fd, "bio"),
      monogram: str(fd, "monogram").slice(0, 2),
      whatsapp: str(fd, "whatsapp"),
      whatsapp_label: str(fd, "whatsapp_label"),
      theme: theme as ThemeKey,
      footer_note: str(fd, "footer_note"),
      ...(avatar === undefined ? {} : { avatar_url: avatar }),
    });

    refresh(slug);
    return { ok: (await messages()).profileSaved };
  } catch (error) {
    return await fail(error);
  }
}

export async function removeAvatarAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    await updateProfile(id, user, { avatar_url: "" });
    refresh(slug);
    return { ok: (await messages()).imageDeleted };
  } catch (error) {
    return await fail(error);
  }
}

export async function saveSlugAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const next = await updateSlug(id, user, str(fd, "slug"));
    refresh(slug);
    refresh(next);
    return { ok: fill((await messages()).slugChanged, { slug: next }) };
  } catch (error) {
    return await fail(error);
  }
}

export async function publishAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const publish = str(fd, "value") === "1";

    // The subscription buys publishing and nothing else, so this is the one gate.
    if (publish && !(await canPublish(user))) {
      return {
        error: (await messages()).publishNeedsPlan,
      };
    }

    await setPublished(id, user, publish);
    refresh(slug);
    const m = await messages();
    return { ok: publish ? m.published : m.unpublished };
  } catch (error) {
    return await fail(error);
  }
}

/* --------------------------------------------------------------- collections */

export async function addItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const t = table(fd);

    // A new row's placeholder text is content, so it follows the interface the
    // customer is editing in.
    const m = await messages();
    const defaults: Record<ChildTable, Record<string, string>> = {
      slides: { headline: m.newSlide, subline: "" },
      projects: { title: m.newProject, category: "" },
      stats: { label: m.newItem, value: "0", icon: "sparkle" },
      socials: { platform: "instagram", url: "" },
    };
    await addChild(t, id, user, defaults[t]);
    refresh(slug);
    return { ok: m.added };
  } catch (error) {
    return await fail(error);
  }
}

export async function saveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const t = table(fd);
    const itemId = str(fd, "itemId");
    const image = await resolveImage(fd, "image", user);

    const fields: Record<string, string> = {};
    for (const key of ["headline", "subline", "caption", "title", "category", "description", "link", "label", "value", "icon", "platform", "url"]) {
      if (fd.get(key) !== null) fields[key] = str(fd, key);
    }

    // Links are rejected here as well as sanitised at render: a stored
    // `javascript:` value should never exist in the first place.
    const m = await messages();
    if (fields.link && !isSafeUrl(fields.link)) {
      return { error: m.badUrl };
    }
    if (fields.url !== undefined && fields.url !== "") {
      const platform = fields.platform ?? str(fd, "platform");
      if (!socialHref(platform || "website", fields.url)) {
        return { error: platform === "email" ? m.badEmail : m.badUrl };
      }
    }
    if (image !== undefined) fields.image_url = image;

    await updateChild(t, id, user, itemId, fields);
    refresh(slug);
    return { ok: m.saved };
  } catch (error) {
    return await fail(error);
  }
}

export async function removeItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    await deleteChild(table(fd), id, user, str(fd, "itemId"));
    refresh(slug);
    return { ok: (await messages()).deleted };
  } catch (error) {
    return await fail(error);
  }
}

export async function moveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const direction = str(fd, "direction") === "up" ? "up" : "down";
    await moveChild(table(fd), id, user, str(fd, "itemId"), direction);
    refresh(slug);
    return { ok: (await messages()).reordered };
  } catch (error) {
    return await fail(error);
  }
}
