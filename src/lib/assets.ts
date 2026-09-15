import "server-only";
import { get, now, run } from "./db";
import { newId } from "./ids";
import { deleteImage, putImage, readImage } from "./storage";
import type { User } from "./types";

// Comfortably under Vercel's 4.5 MB serverless request cap, and far above what
// the editor's cropper actually produces (a framed WebP is typically under 500 KB).
const MAX_BYTES = 4 * 1024 * 1024;

// SVG is deliberately excluded: it can carry script, and assets are served from
// this app's own origin.
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export async function storeImage(file: File, user: User): Promise<string> {
  if (!file || file.size === 0) throw new Error("لم يتم اختيار صورة");
  if (file.size > MAX_BYTES) throw new Error("حجم الصورة يتجاوز 4 ميجابايت");
  if (!ALLOWED.has(file.type)) throw new Error("صيغة الصورة غير مدعومة");

  const id = newId("ast");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = await putImage(id, bytes, file.type);

  await run(
    `INSERT INTO assets (id, owner_id, mime, storage_path, byte_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    file.type,
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
