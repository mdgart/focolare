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

/** Parse a free-text line into structured parts. */
export function parseIngredientLine(line: string): { name: string; amount?: string; unit?: string } {
  const t = line.trim();
  if (!t) return { name: "" };
  const three = t.match(/^([\d.,/¼½¾⅓⅔⅛]+)\s+(\S+)\s+(.+)$/);
  if (three) return { amount: three[1]!, unit: three[2]!, name: three[3]!.trim() };
  const two = t.match(/^([\d.,/¼½¾⅓⅔⅛]+)\s+(.+)$/);
  if (two) return { amount: two[1]!, name: two[2]!.trim() };
  return { name: t };
}

export function formatIngredientLine(ing: { name: string; amount?: string; unit?: string }): string {
  return [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ").trim();
}
