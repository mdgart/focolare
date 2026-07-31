import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

/**
 * Where uploaded media lives.
 *
 * Serverless filesystems are ephemeral — anything written to disk on Vercel is gone
 * on the next invocation — so production must use Vercel Blob (object storage on a CDN).
 * Local development keeps the old on-disk path so the app runs with no cloud account.
 *
 * The switch is the presence of `BLOB_READ_WRITE_TOKEN`, which Vercel injects
 * automatically once a Blob store is linked to the project.
 */
export function usingBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export type StoredFile = {
  /** Identifier we persist on media_asset. For Blob this is the pathname, on disk the filename. */
  storageKey: string;
  /** Directly fetchable URL: a CDN URL under Blob, an /api/files/… route on disk. */
  publicUrl: string;
};

function localUploadDir(): string {
  const rel = process.env.UPLOAD_DIR ?? ".data/uploads";
  return path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

/** Persist bytes and return where they ended up. */
export async function storeFile(opts: {
  data: Buffer;
  /** Used for the extension only; never trusted as a path. */
  filename?: string;
  contentType: string;
  /** Groups objects in the Blob store, e.g. "covers". */
  prefix?: string;
}): Promise<StoredFile> {
  const ext = path.extname(opts.filename ?? "") || extensionFor(opts.contentType);
  const name = `${nanoid(12)}${ext}`;
  const key = opts.prefix ? `${opts.prefix}/${name}` : name;

  if (usingBlobStorage()) {
    const blob = await put(key, opts.data, {
      access: "public",
      contentType: opts.contentType,
      // Our key is already unique; without this Blob appends its own suffix.
      addRandomSuffix: false,
    });
    return { storageKey: blob.pathname, publicUrl: blob.url };
  }

  const dir = localUploadDir();
  await mkdir(dir, { recursive: true });
  // On disk we keep a flat layout, so collapse any prefix into the filename.
  const flatName = key.replace(/\//g, "-");
  await writeFile(path.join(dir, flatName), opts.data);
  return {
    storageKey: flatName,
    publicUrl: `${appBaseUrl()}/api/files/${encodeURIComponent(flatName)}`,
  };
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/jpeg") return ".jpg";
  return ".bin";
}

/**
 * Read stored bytes back as a data URL, for sending images to moderation.
 * Under Blob the object is already public, so callers should pass the URL straight
 * through instead — this only handles the local-disk case.
 */
export async function localFileAsDataUrl(
  storageKey: string,
  mimeType: string,
): Promise<string | null> {
  try {
    if (storageKey.includes("/") || storageKey.includes("..")) return null;
    const buf = await readFile(path.join(localUploadDir(), storageKey));
    if (buf.byteLength > 12 * 1024 * 1024) return null;
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
