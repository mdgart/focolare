export type IngredientMeasureSystem = "metric" | "us";

export function ingredientSystemTitle(system: IngredientMeasureSystem): string {
  return system === "metric" ? "Metric (international)" : "US volumetric";
}

export function ingredientSystemShort(system: IngredientMeasureSystem): string {
  return system === "metric" ? "Metric" : "US volumes";
}

export function ingredientListPlaceholder(system: IngredientMeasureSystem): string {
  return system === "metric"
    ? "500 g bread flour\n375 ml water\n10 g fine sea salt"
    : "3 c bread flour\n1⅓ c warm water\n2 tbsp olive oil\n1 tsp kosher salt";
}

export function ingredientListHelp(system: IngredientMeasureSystem): string {
  return system === "metric"
    ? "One ingredient per line. Optional pattern: amount unit name — e.g. 500 g bread flour, 2 ml vanilla."
    : "One ingredient per line. Optional pattern: amount unit name — e.g. 2 c flour, 1 tbsp butter, ½ tsp salt.";
}

/**
 * One quantity, in the shapes recipes are written in.
 *
 * Mixed fractions come first so "1 1/2" is read whole. Getting that order wrong
 * is what made "1 1/2 cups flour" parse as amount 1 with a *unit* of "1/2":
 * harmless-looking, because the parts join back into the original line, until
 * the amount is scaled and the stray "1/2" sits there next to it.
 */
const QUANTITY = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?`;

/** The same, allowing "2-3" and "2 to 3". */
const QUANTITY_OR_RANGE = new RegExp(
  String.raw`^((?:${QUANTITY})(?:\s*(?:-|–|—|to)\s*(?:${QUANTITY}))?)\s+(.+)$`,
);

/** True when a token is itself a number, and so can't be a unit. */
const LOOKS_NUMERIC = new RegExp(String.raw`^(?:${QUANTITY})$`);

/**
 * Parse a free-text line into structured parts.
 *
 * A unit is only taken when something is left over for the name, so "3 eggs"
 * keeps "eggs" as the name rather than calling it a unit — and a token that is
 * itself a number is never treated as one.
 */
export function parseIngredientLine(line: string): { name: string; amount?: string; unit?: string } {
  const t = line.trim();
  if (!t) return { name: "" };

  const match = t.match(QUANTITY_OR_RANGE);
  if (!match) return { name: t };

  const amount = match[1]!.replace(/\s+/g, " ").trim();
  const rest = match[2]!.trim();

  const [first, ...others] = rest.split(/\s+/);
  if (first && others.length > 0 && !LOOKS_NUMERIC.test(first)) {
    return { amount, unit: first, name: others.join(" ") };
  }
  return { amount, name: rest };
}

/**
 * Repair a line whose quantity was split across amount and unit.
 *
 * Recipes stored before the parser understood mixed fractions have rows like
 * `{ amount: "1", unit: "1/2", name: "cups flour" }`. Left alone they display
 * correctly by accident and scale into nonsense, so the stray number is folded
 * back into the amount wherever ingredients are read.
 */
export function repairIngredientParts<T extends { amount?: string; unit?: string; name: string }>(
  ing: T,
): T {
  const unit = ing.unit?.trim();
  if (!unit || !LOOKS_NUMERIC.test(unit)) return ing;

  const amount = [ing.amount?.trim(), unit].filter(Boolean).join(" ");
  // The old unit column held the second half of the number, so the real unit
  // (if there was one) is the first word of the name.
  const [maybeUnit, ...rest] = ing.name.trim().split(/\s+/);
  if (maybeUnit && rest.length > 0 && !LOOKS_NUMERIC.test(maybeUnit)) {
    return { ...ing, amount, unit: maybeUnit, name: rest.join(" ") };
  }
  return { ...ing, amount, unit: undefined };
}

export function formatIngredientLine(ing: { name: string; amount?: string; unit?: string }): string {
  return [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ").trim();
}
