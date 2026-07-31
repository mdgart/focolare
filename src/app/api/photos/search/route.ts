import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { searchStockPhotos, stockPhotosEnabled } from "@/lib/stock-photos";

/** Photo suggestions for a recipe. Signed in only, so the API key isn't a public proxy. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!stockPhotosEnabled()) {
    return Response.json({ error: "Photo search is not configured on this server." }, { status: 503 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ photos: [] });

  return Response.json({ photos: await searchStockPhotos(q) });
}
