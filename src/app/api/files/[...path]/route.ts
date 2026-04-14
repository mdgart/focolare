import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const mimeByExt: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.join("/");
  if (!key || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const rel = process.env.UPLOAD_DIR ?? ".data/uploads";
  const uploadDir = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  const filePath = path.join(uploadDir, decodeURIComponent(key));
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeByExt[ext] ?? "application/octet-stream";
  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
