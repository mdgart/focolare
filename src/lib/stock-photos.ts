/**
 * Free stock photo search, for cooks who don't have a photo of their own and
 * would rather not spend an AI credit generating one.
 *
 * Backed by Pexels: free for commercial use with no attribution legally required,
 * though we store and display the photographer's name anyway — it costs nothing
 * and it's the decent thing to do.
 *
 * The provider is deliberately behind this one module so swapping sources later
 * touches nothing else.
 */

export type StockPhoto = {
  /** Provider-scoped id, used to fetch the full-size file on import. */
  id: string;
  /** Small preview for the picker grid. */
  thumbUrl: string;
  /** Full-size file we download when the user picks it. */
  fullUrl: string;
  /** Photographer name. */
  credit: string;
  /** Link back to the original. */
  creditUrl: string;
  alt: string;
  width: number;
  height: number;
};

export function stockPhotosEnabled(): boolean {
  return Boolean(process.env.PEXELS_API_KEY?.trim());
}

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  alt: string | null;
  photographer: string;
  photographer_url: string;
  src: { large2x: string; large: string; medium: string; landscape: string };
};

/**
 * Search for photos matching a recipe.
 *
 * Returns an empty list rather than throwing when unconfigured or when the
 * provider is unhappy — this is a convenience, and a photo service being down
 * must never stop someone publishing.
 */
export async function searchStockPhotos(
  query: string,
  opts?: { perPage?: number },
): Promise<StockPhoto[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];

  const q = query.trim().slice(0, 100);
  if (!q) return [];

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", String(Math.min(opts?.perPage ?? 12, 24)));
  // Recipe covers render in a 4:3 / 16:10 frame, so portrait results waste the crop.
  url.searchParams.set("orientation", "landscape");

  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      // Same query returns the same photos; caching keeps us well inside rate limits.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[stock-photos] search failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    return (data.photos ?? []).map((p) => ({
      id: String(p.id),
      thumbUrl: p.src.medium,
      fullUrl: p.src.large2x || p.src.large,
      credit: p.photographer,
      creditUrl: p.photographer_url,
      alt: p.alt?.trim() || q,
      width: p.width,
      height: p.height,
    }));
  } catch (e) {
    console.error("[stock-photos] search error:", e);
    return [];
  }
}

/** Look up one photo by id, so import never trusts a client-supplied URL. */
export async function getStockPhoto(id: string): Promise<StockPhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;
  if (!/^\d+$/.test(id)) return null;

  try {
    const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
      headers: { Authorization: key },
    });
    if (!res.ok) return null;
    const p = (await res.json()) as PexelsPhoto;
    return {
      id: String(p.id),
      thumbUrl: p.src.medium,
      fullUrl: p.src.large2x || p.src.large,
      credit: p.photographer,
      creditUrl: p.photographer_url,
      alt: p.alt?.trim() || "",
      width: p.width,
      height: p.height,
    };
  } catch {
    return null;
  }
}
