import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded images actually live.
 *
 * Two drivers, one interface. `local` writes to disk and is what development
 * uses; `supabase` uploads to a private Storage bucket and is what production
 * must use, because a serverless filesystem is wiped between invocations and
 * blobs in Postgres bloat every backup.
 *
 * The bucket is private on purpose: a suspended portfolio's images have to stop
 * being served, which a public URL cannot do. Reads go through the app, which
 * checks state and then hands out a short-lived signed URL.
 */
export type StorageDriver = "local" | "supabase";

export const storageDriver = (): StorageDriver =>
  (process.env.STORAGE_DRIVER as StorageDriver) ??
  (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "portfolio-images";
const LOCAL_DIR = path.join(process.cwd(), "data", "uploads");

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/avif": "avif",
  "image/gif": "gif",
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "STORAGE_DRIVER is supabase but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.",
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

/** Stores the bytes and returns the path to record against the asset row. */
export async function putImage(
  assetId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const objectPath = `${assetId}.${EXTENSION[mime] ?? "bin"}`;

  if (storageDriver() === "local") {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, objectPath), bytes);
    return objectPath;
  }

  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    // Copy into a plain ArrayBuffer: fetch will not take a Uint8Array view directly.
    body: bytes.slice().buffer as ArrayBuffer,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status}): ${await response.text()}`);
  }
  return objectPath;
}

/** Bytes for the local driver; the Supabase driver hands back a signed URL instead. */
export async function readImage(
  objectPath: string,
): Promise<{ kind: "bytes"; bytes: Uint8Array } | { kind: "redirect"; url: string }> {
  if (storageDriver() === "local") {
    const bytes = await fs.readFile(path.join(LOCAL_DIR, objectPath));
    return { kind: "bytes", bytes: new Uint8Array(bytes) };
  }

  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Short-lived: long enough to load the page, short enough that a takedown bites.
    body: JSON.stringify({ expiresIn: 300 }),
  });

  if (!response.ok) {
    throw new Error(`Could not sign storage URL (${response.status})`);
  }

  const { signedURL } = (await response.json()) as { signedURL: string };
  return { kind: "redirect", url: `${url}/storage/v1${signedURL}` };
}

export async function deleteImage(objectPath: string): Promise<void> {
  if (storageDriver() === "local") {
    await fs.rm(path.join(LOCAL_DIR, objectPath), { force: true });
    return;
  }

  const { url, key } = supabaseConfig();
  await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => {});
}
