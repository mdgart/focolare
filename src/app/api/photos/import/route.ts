import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mediaAsset } from "@/db/schema";
import { storeFile } from "@/lib/storage";
import { getStockPhoto, stockPhotosEnabled } from "@/lib/stock-photos";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copy a chosen stock photo into our own storage.
 *
 * Takes a provider photo id, never a URL: the client cannot make the server
 * fetch an arbitrary address, and the download target comes from the provider's
 * own response. Hot-linking is avoided too — if the photo later disappears
 * upstream, recipes already using it keep working.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!stockPhotosEnabled()) {
    return Response.json({ error: "Photo search is not configured on this server." }, { status: 503 });
  }

  let body: { photoId?: string };
  try {
    body = (await req.json()) as { photoId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const photoId = body.photoId?.trim();
  if (!photoId) return Response.json({ error: "photoId required" }, { status: 400 });

  const photo = await getStockPhoto(photoId);
  if (!photo) return Response.json({ error: "That photo is no longer available." }, { status: 404 });

  try {
    const res = await fetch(photo.fullUrl);
    if (!res.ok) {
      return Response.json({ error: "Couldn't download that photo." }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return Response.json({ error: "That file isn't an image." }, { status: 415 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ error: "That photo is too large." }, { status: 413 });
    }

    const stored = await storeFile({
      data: buf,
      filename: `pexels-${photo.id}.jpg`,
      contentType,
      prefix: "stock",
    });

    const [row] = await db
      .insert(mediaAsset)
      .values({
        ownerUserId: session.user.id,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        mimeType: contentType,
        kind: "image",
        width: photo.width,
        height: photo.height,
        attribution: `Photo by ${photo.credit} on Pexels`,
        attributionUrl: photo.creditUrl,
      })
      .returning();

    return Response.json({ media: row });
  } catch (e) {
    console.error("[photos] import failed:", e);
    return Response.json({ error: "Couldn't import that photo — try again." }, { status: 502 });
  }
}
