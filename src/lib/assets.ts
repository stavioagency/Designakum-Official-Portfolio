import "server-only";
import { get, now, run } from "./db";
import { newId } from "./ids";
import type { User } from "./types";

const MAX_BYTES = 6 * 1024 * 1024;
// SVG is deliberately excluded: it can carry script, and assets are served from
// this app's own origin.
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export async function storeImage(file: File, user: User): Promise<string> {
  if (!file || file.size === 0) throw new Error("لم يتم اختيار صورة");
  if (file.size > MAX_BYTES) throw new Error("حجم الصورة يتجاوز 6 ميجابايت");
  if (!ALLOWED.has(file.type)) throw new Error("صيغة الصورة غير مدعومة");

  const id = newId("ast");
  const bytes = new Uint8Array(await file.arrayBuffer());
  await run(
    "INSERT INTO assets (id, owner_id, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    user.id,
    file.type,
    bytes,
    now(),
  );
  return `/api/asset/${id}`;
}

export interface StoredAsset {
  mime: string;
  bytes: Uint8Array;
  owner_status: string;
  portfolio_suspended: number | null;
}

/**
 * Images live behind unguessable ids, but "unguessable" is not a takedown: once a
 * portfolio is suspended its pictures have usually been hotlinked elsewhere. The
 * owner's account and portfolio state travel with the row so the route can refuse.
 */
export async function readAsset(id: string) {
  return await get<StoredAsset>(
    `SELECT a.mime, a.bytes, u.status AS owner_status,
            (SELECT MAX(p.suspended) FROM portfolios p WHERE p.user_id = a.owner_id) AS portfolio_suspended
       FROM assets a
       JOIN users u ON u.id = a.owner_id
      WHERE a.id = ?`,
    id,
  );
}
