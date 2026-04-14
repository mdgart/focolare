import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mediaAsset } from "@/db/schema";
import { nanoid } from "nanoid";

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

  const rel = process.env.UPLOAD_DIR ?? ".data/uploads";
  const uploadDir = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name || "") || ".bin";
  const storageKey = `${nanoid(12)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, storageKey), buf);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicUrl = `${base}/api/files/${encodeURIComponent(storageKey)}`;

  const [row] = await db
    .insert(mediaAsset)
    .values({
      ownerUserId: session.user.id,
      storageKey,
      publicUrl,
      mimeType: file.type,
      kind: "image",
    })
    .returning();

  return Response.json({ media: row });
}
