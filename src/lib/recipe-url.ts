/**
 * Where a recipe lives: /c/<username>/recipe/<recipe-slug>.
 *
 * The id-based URL (/recipe/<uuid>) still resolves — it redirects here — so
 * anything holding only an id can keep linking by id. Prefer the readable path
 * wherever both slugs are already loaded, which is most listings.
 */
export function recipePath(channelSlug: string, recipeSlug: string): string {
  return `/c/${encodeURIComponent(channelSlug)}/recipe/${encodeURIComponent(recipeSlug)}`;
}

export function recipeEditPath(channelSlug: string, recipeSlug: string): string {
  return `${recipePath(channelSlug, recipeSlug)}/edit`;
}

/** The redirecting id URL, for callers that only have the id. */
export function recipeIdPath(recipeId: string): string {
  return `/recipe/${recipeId}`;
}

type HrefParts = { recipeId: string; channelSlug?: string | null; recipeSlug?: string | null };

/** The readable path when both slugs are known, the id path when they aren't. */
export function recipeHref(opts: HrefParts): string {
  return opts.channelSlug && opts.recipeSlug
    ? recipePath(opts.channelSlug, opts.recipeSlug)
    : recipeIdPath(opts.recipeId);
}

export function recipeEditHref(opts: HrefParts): string {
  return `${recipeHref(opts)}/edit`;
}
