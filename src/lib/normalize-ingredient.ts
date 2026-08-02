/**
 * Matching ingredient names against pantry staples and on-hand items.
 *
 * Recipe ingredient names are free prose — "onion, finely diced", "Plain Flour",
 * "eggs". There is no ontology here and no attempt at one; matching is
 * deliberately conservative.
 *
 * The asymmetry matters: failing to match leaves an item on the shopping list
 * you already own, which is mildly annoying. Matching too eagerly silently drops
 * something you needed, and you find out in the middle of cooking. So this only
 * matches on the whole name (after stripping preparation notes) or a simple
 * plural, and never on substrings — "flour" must not swallow "almond flour".
 */

/** Lowercase, strip prep notes after a comma, collapse whitespace and punctuation. */
export function normalizeIngredientName(raw: string): string {
  return raw
    .toLowerCase()
    // "onion, finely diced" -> "onion"; the note is never the ingredient.
    .split(",")[0]!
    // "flour (plain)" -> "flour"
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap English plural fold, enough for eggs/tomatoes/berries. */
function singularize(name: string): string {
  if (name.endsWith("ies") && name.length > 4) return `${name.slice(0, -3)}y`;
  if (name.endsWith("oes") && name.length > 4) return name.slice(0, -2);
  if (name.endsWith("ses") && name.length > 4) return name.slice(0, -2);
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 3) return name.slice(0, -1);
  return name;
}

/** Every spelling of a name worth checking against the covered set. */
export function nameVariants(raw: string): string[] {
  const base = normalizeIngredientName(raw);
  if (!base) return [];
  const singular = singularize(base);
  return base === singular ? [base] : [base, singular];
}

/** Build the lookup set from staples and on-hand items. */
export function buildCoveredSet(names: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of names) {
    for (const variant of nameVariants(name)) set.add(variant);
  }
  return set;
}

/** True when the pantry plausibly already contains this ingredient. */
export function ingredientCoveredBy(name: string, covered: Set<string>): boolean {
  return nameVariants(name).some((variant) => covered.has(variant));
}
