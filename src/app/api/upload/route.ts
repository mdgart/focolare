import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mediaAsset } from "@/db/schema";
import { storeFile } from "@/lib/storage";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file field required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "Unsupported type" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "Max 5MB" }, { status: 400 });
  }

  // Storing and recording are separate failure modes worth telling apart: object
  // storage being misconfigured and the database being behind the code produce the
  // same blank 500 otherwise, which is what made this hard to diagnose in production.
  let stored;
  try {
    stored = await storeFile({
      data: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
      prefix: "uploads",
    });
  } catch (e) {
    console.error("[upload] could not store the file:", e);
    return Response.json(
      { error: "Couldn't save the image. If this keeps happening, the storage backend needs attention." },
      { status: 502 },
    );
  }

  try {
    const [row] = await db
      .insert(mediaAsset)
      .values({
        ownerUserId: session.user.id,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        mimeType: file.type,
        kind: "image",
      })
      .returning();
    return Response.json({ media: row });
  } catch (e) {
    console.error("[upload] stored the file but could not record it:", e);
    return Response.json(
      { error: "The image uploaded but couldn't be recorded. This usually means the database is behind the deployed code." },
      { status: 500 },
    );
  }
}
