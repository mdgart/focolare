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

  const stored = await storeFile({
    data: Buffer.from(await file.arrayBuffer()),
    filename: file.name,
    contentType: file.type,
    prefix: "uploads",
  });

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
}
