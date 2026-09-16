"use server";

import fs from "node:fs/promises";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { BRAND_ASSETS, type BrandAssetName } from "@/lib/brand";
import type { ActionState } from "./portfolio";
import { reportError } from "@/lib/observability";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Brand artwork is owner-only, so SVG is allowed here even though it is refused
 * for client uploads: these files come from the platform owner, are written to a
 * fixed set of names, and are the format a logo is normally delivered in.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/avif": ".avif",
};

const KNOWN = new Set<string>([
  ...BRAND_ASSETS.map((a) => a.name),
  "favicon",
  "icon",
]);

async function fail(error: unknown): Promise<ActionState> {
  reportError(error, { area: "brand-assets" });
  return { error: error instanceof Error ? error.message : (await messages()).uploadFailed };
}

export async function uploadBrandAssetAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  try {
    await requireOwner();

    const name = String(fd.get("name") ?? "");
    if (!KNOWN.has(name)) return { error: (await messages()).unknownFileName };

    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: (await messages()).noFileChosen };
    if (file.size > MAX_BYTES) return { error: (await messages()).fileTooLarge };

    const extension = EXTENSION_BY_TYPE[file.type];
    if (!extension) return { error: (await messages()).unsupportedFormat };

    await fs.mkdir(BRAND_DIR, { recursive: true });

    // One name, one file: drop any other extension already sitting under it, so a
    // PNG replacing an SVG doesn't leave the old file to win the lookup.
    for (const ext of Object.values(EXTENSION_BY_TYPE)) {
      if (ext !== extension) await fs.rm(path.join(BRAND_DIR, name + ext), { force: true });
    }

    await fs.writeFile(
      path.join(BRAND_DIR, name + extension),
      Buffer.from(await file.arrayBuffer()),
    );

    revalidatePath("/", "layout");
    return { ok: fill((await messages()).fileUploaded, { file: `${name}${extension}` }) };
  } catch (error) {
    return await fail(error);
  }
}

export async function deleteBrandAssetAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  try {
    await requireOwner();

    const name = String(fd.get("name") ?? "");
    if (!KNOWN.has(name)) return { error: (await messages()).unknownFileName };

    for (const ext of Object.values(EXTENSION_BY_TYPE)) {
      await fs.rm(path.join(BRAND_DIR, name + ext), { force: true });
    }

    revalidatePath("/", "layout");
    return { ok: fill((await messages()).fileDeleted, { file: name }) };
  } catch (error) {
    return await fail(error);
  }
}

export type BrandAssetSlot = {
  name: BrandAssetName | "favicon";
  description: string;
  url: string | null;
};
