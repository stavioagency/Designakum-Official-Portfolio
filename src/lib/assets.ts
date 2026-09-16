import "server-only";
import { get, now, run } from "./db";
import { newId } from "./ids";
import { deleteImage, putImage, readImage } from "./storage";
import { imageInfo } from "./image-info";
import { messages } from "./locale";
import type { User } from "./types";

// Comfortably under Vercel's 4.5 MB serverless request cap, and far above what
// the editor's cropper actually produces (a framed WebP is typically under 500 KB).
const MAX_BYTES = 4 * 1024 * 1024;

// SVG is deliberately excluded: it can carry script, and assets are served from
// this app's own origin.
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

/**
 * Dimension caps. File size alone cannot see a decompression bomb — 40 KB on the
 * wire can declare 40 000 × 40 000 pixels, which is 6 GB once anything renders
 * it. The per-side cap covers the pathological aspect ratios that slip under a
 * megapixel budget, and 40 MP is far above the largest photograph anyone will
 * reasonably put on a portfolio page.
 */
const MAX_SIDE = 12_000;
const MAX_PIXELS = 40_000_000;

export async function storeImage(file: File, user: User): Promise<string> {
  // The words come from the dictionary: this runs inside the customer's own
  // request, and they should be told what went wrong in their language.
  const m = await messages();
  if (!file || file.size === 0) throw new Error(m.noImageChosen);
  if (file.size > MAX_BYTES) throw new Error(m.imageTooLarge);
  if (!ALLOWED.has(file.type)) throw new Error(m.imageFormat);

  const bytes = new Uint8Array(await file.arrayBuffer());

  // The browser's Content-Type is a claim; the magic bytes are the fact. Storing
  // the parsed type means the asset route can never be talked into serving
  // something as an image that is not one.
  const info = imageInfo(bytes);
  if (!info || !ALLOWED.has(info.mime)) throw new Error(m.notAnImage);
  if (info.width < 1 || info.height < 1) throw new Error(m.notAnImage);
  if (info.width > MAX_SIDE || info.height > MAX_SIDE || info.width * info.height > MAX_PIXELS) {
    throw new Error(m.imageTooBig);
  }

  const id = newId("ast");
  const storagePath = await putImage(id, bytes, info.mime);

  await run(
    `INSERT INTO assets (id, owner_id, mime, storage_path, byte_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    info.mime,
    storagePath,
    bytes.byteLength,
    now(),
  );

  return `/api/asset/${id}`;
}

export interface StoredAsset {
  mime: string;
  storage_path: string | null;
  bytes: Uint8Array | null;
  owner_status: string;
  portfolio_suspended: number | null;
}

/**
 * Images live behind unguessable ids, but "unguessable" is not a takedown: once a
 * portfolio is suspended its pictures have usually been hotlinked elsewhere. The
 * owner's account and portfolio state travel with the row so the route can refuse.
 */
export async function readAsset(id: string) {
  return get<StoredAsset>(
    `SELECT a.mime, a.storage_path, a.bytes, u.status AS owner_status,
            (SELECT MAX(p.suspended) FROM portfolios p WHERE p.user_id = a.owner_id) AS portfolio_suspended
       FROM assets a
       JOIN users u ON u.id = a.owner_id
      WHERE a.id = ?`,
    id,
  );
}

/** Resolves an asset to something the route can respond with. */
export async function openAsset(asset: StoredAsset) {
  // Rows imported from the SQLite era still carry their bytes inline.
  if (asset.storage_path) return readImage(asset.storage_path);
  if (asset.bytes) return { kind: "bytes" as const, bytes: new Uint8Array(asset.bytes) };
  return null;
}

export async function forgetImage(assetId: string) {
  const asset = await get<{ storage_path: string | null }>(
    "SELECT storage_path FROM assets WHERE id = ?",
    assetId,
  );
  if (asset?.storage_path) await deleteImage(asset.storage_path);
  await run("DELETE FROM assets WHERE id = ?", assetId);
}
