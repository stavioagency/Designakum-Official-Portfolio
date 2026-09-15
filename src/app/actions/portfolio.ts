"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { storeImage } from "@/lib/assets";
import { entitlementsFor } from "@/lib/billing";
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
  if (!TABLES.includes(t)) throw new Error("جدول غير معروف");
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

function fail(error: unknown): ActionState {
  if (error instanceof TenantError) return { error: error.message };
  reportError(error, { area: "portfolio" });
  return { error: error instanceof Error ? error.message : "تعذّر حفظ التغييرات" };
}

/* -------------------------------------------------------------------- profile */

export async function saveProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const avatar = await resolveImage(fd, "avatar", user);
    const theme = str(fd, "theme");
    if (!(theme in THEMES)) return { error: "لون الهوية غير معروف" };

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
    return { ok: "تم حفظ الملف الشخصي" };
  } catch (error) {
    return fail(error);
  }
}

export async function removeAvatarAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    await updateProfile(id, user, { avatar_url: "" });
    refresh(slug);
    return { ok: "تم حذف الصورة" };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSlugAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const next = await updateSlug(id, user, str(fd, "slug"));
    refresh(slug);
    refresh(next);
    return { ok: `أصبح رابطك /p/${next}` };
  } catch (error) {
    return fail(error);
  }
}

export async function publishAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const publish = str(fd, "value") === "1";
    await setPublished(id, user, publish);
    refresh(slug);
    return { ok: publish ? "تم نشر معرضك" : "تم إخفاء معرضك عن الزوار" };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- collections */

export async function addItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const t = table(fd);

    // Free accounts are capped; a paid subscription lifts the cap entirely.
    const limits = await entitlementsFor(user);
    const cap = t === "projects" ? limits.maxProjects : t === "slides" ? limits.maxSlides : Infinity;
    if (Number.isFinite(cap)) {
      const count = (await all<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${t} WHERE portfolio_id = ?`,
        id,
      ))[0].n;
      if (count >= cap) {
        const noun = t === "projects" ? "من الأعمال" : "من الشرائح";
        return {
          error: `وصلت إلى الحد الأقصى ${cap} ${noun} في الخطة المجانية. رقِّ اشتراكك لإضافة المزيد.`,
        };
      }
    }

    const defaults: Record<ChildTable, Record<string, string>> = {
      slides: { headline: "عنوان جديد", subline: "" },
      projects: { title: "عمل جديد", category: "" },
      stats: { label: "عنصر جديد", value: "0", icon: "sparkle" },
      socials: { platform: "instagram", url: "" },
    };
    await addChild(t, id, user, defaults[t]);
    refresh(slug);
    return { ok: "تمت الإضافة" };
  } catch (error) {
    return fail(error);
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
    if (fields.link && !isSafeUrl(fields.link)) {
      return { error: "الرابط غير صالح — استخدم عنوانًا يبدأ بـ https://" };
    }
    if (fields.url !== undefined && fields.url !== "") {
      const platform = fields.platform ?? str(fd, "platform");
      if (!socialHref(platform || "website", fields.url)) {
        return {
          error:
            platform === "email"
              ? "أدخل بريدًا إلكترونيًا صحيحًا"
              : "الرابط غير صالح — استخدم عنوانًا يبدأ بـ https://",
        };
      }
    }
    if (image !== undefined) fields.image_url = image;

    await updateChild(t, id, user, itemId, fields);
    refresh(slug);
    return { ok: "تم الحفظ" };
  } catch (error) {
    return fail(error);
  }
}

export async function removeItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    await deleteChild(table(fd), id, user, str(fd, "itemId"));
    refresh(slug);
    return { ok: "تم الحذف" };
  } catch (error) {
    return fail(error);
  }
}

export async function moveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, id, slug } = await withPortfolio(fd);
    const direction = str(fd, "direction") === "up" ? "up" : "down";
    await moveChild(table(fd), id, user, str(fd, "itemId"), direction);
    refresh(slug);
    return { ok: "تم الترتيب" };
  } catch (error) {
    return fail(error);
  }
}
