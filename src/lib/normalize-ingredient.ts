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
 * matches on the whole name (after stripping preparation notes and grade words)
 * or a simple plural, and never on substrings — "flour" must not swallow
 * "almond flour".
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

/**
 * Leading words that grade an ingredient without changing what it is.
 *
 * These are what let a pantry "milk" cover a recipe's "whole milk". Membership
 * is deliberately narrow, and the test for admitting a word is strict: would a
 * shopper come home with a *different product* because of it? If yes, it stays
 * out. So substance modifiers are absent — "almond milk", "coconut milk" and
 * "almond flour" still fail to match "milk" and "flour", which is the point.
 * "brown" (sugar), "smoked" (paprika), "dried", "fresh", "frozen", "wholemeal"
 * and every colour are excluded for the same reason: each names a thing you'd
 * have to buy separately.
 *
 * Only *leading* words are stripped, so "milk chocolate" and "butter beans"
 * keep their heads and never collapse into "chocolate" or "beans".
 */
const GRADE_WORDS = new Set([
  // Fat content: "whole milk", "semi-skimmed milk", "low-fat yoghurt", "fat-free"
  "whole",
  "semi",
  "skimmed",
  "skim",
  "low",
  "reduced",
  "full",
  "fat",
  // Grade and provenance: "extra-virgin olive oil", "free-range eggs", "organic"
  "free",
  "range",
  "extra",
  "virgin",
  "organic",
  // Size: "large eggs", "medium onion"
  "large",
  "small",
  "medium",
  "jumbo",
  // Seasoning and cut, where the ingredient itself is unchanged
  "unsalted",
  "salted",
  "plain",
  "ripe",
  "boneless",
  "skinless",
  "fine",
  "coarse",
]);

/**
 * "large free-range eggs" -> "eggs". Splits on hyphens too, so "semi-skimmed"
 * and "semi skimmed" behave the same. Never strips the last word: "extra virgin"
 * on its own stays as it is rather than becoming nothing.
 */
function stripGradeWords(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  let first = 0;
  while (first < words.length - 1 && GRADE_WORDS.has(words[first]!)) first++;
  return words.slice(first).join(" ");
}

/**
 * Things nobody puts on a shopping list, treated as permanently on hand.
 *
 * Recipes list water as an ingredient because it goes in the pot, not because
 * you need to buy it. Bottled kinds are left alone — "sparkling water" and
 * "coconut water" don't match "water" under whole-name matching, so they still
 * reach the list.
 */
export const ASSUMED_ON_HAND = [
  "water",
  "tap water",
  "cold water",
  "warm water",
  "hot water",
  "lukewarm water",
  "boiling water",
  "iced water",
  "ice water",
  "ice",
  "ice cubes",
];

/** Cheap English plural fold, enough for eggs/tomatoes/berries. */
function singularize(name: string): string {
  if (name.endsWith("ies") && name.length > 4) return `${name.slice(0, -3)}y`;
  if (name.endsWith("oes") && name.length > 4) return name.slice(0, -2);
  if (name.endsWith("ses") && name.length > 4) return name.slice(0, -2);
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 3) return name.slice(0, -1);
  return name;
}

/**
 * Every spelling of a name worth checking against the covered set.
 *
 * Both sides of the comparison run through this, so the graded form matches
 * whichever side it appears on: a pantry "milk" covers a recipe's "whole milk",
 * and a pantry "whole milk" covers a recipe's "milk".
 */
export function nameVariants(raw: string): string[] {
  const base = normalizeIngredientName(raw);
  if (!base) return [];
  const variants = new Set<string>();
  for (const form of [base, stripGradeWords(base)]) {
    variants.add(form);
    variants.add(singularize(form));
  }
  return [...variants];
}

/** Build the lookup set from staples and on-hand items. */
export function buildCoveredSet(names: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of [...ASSUMED_ON_HAND, ...names]) {
    for (const variant of nameVariants(name)) set.add(variant);
  }
  return set;
}

/** True when the pantry plausibly already contains this ingredient. */
export function ingredientCoveredBy(name: string, covered: Set<string>): boolean {
  return nameVariants(name).some((variant) => covered.has(variant));
}
