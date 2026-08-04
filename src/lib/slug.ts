/**
 * Text as a URL segment. Accents fold to their base letter rather than becoming
 * separators, so "Béchamel Sauce" reads as bechamel-sauce and not b-chamel-sauce
 * — these end up in recipe addresses people share.
 */
export function slugify(input: string): string {
  const s = foldAccents(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return s.length > 0 ? s : "item";
}

/** Strip the combining marks NFKD splits off, leaving the base letters. */
export function foldAccents(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
