import { formatIngredientLine } from "@/lib/ingredient-measure";
import { buildCoveredSet, ingredientCoveredBy, normalizeIngredientName } from "@/lib/normalize-ingredient";

/**
 * Turning a plan's recipes into a shopping list.
 *
 * Amounts are **never** summed. They are free text — "½", "2-3", "a splash",
 * "1 × 28 oz" — so any arithmetic would be invented. Instead each ingredient
 * gets one row listing what each recipe asks for, and the human decides how much
 * to buy. "Flour — 500 g (Country loaf) · 2 cups (Pancakes)" is honest and
 * actually more useful at the shop than a fabricated total.
 */

export type RecipeForGrocery = {
  id: string;
  title: string;
  ingredients: { amount?: string; unit?: string; name: string }[];
};

export type GrocerySource = { recipeId: string; recipeTitle: string; amountText: string };

export type GroceryDraft = {
  name: string;
  normalizedName: string;
  detail: string;
  sources: GrocerySource[];
  coveredByPantry: boolean;
};

/**
 * One row per distinct ingredient across the plan's recipes.
 *
 * `covered` holds normalized staple and on-hand names; matches are flagged
 * rather than dropped so a wrong match stays visible and recoverable.
 */
export function buildGroceryDrafts(
  recipes: RecipeForGrocery[],
  covered: Set<string>,
): GroceryDraft[] {
  const byName = new Map<string, GroceryDraft>();

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients ?? []) {
      const displayName = ingredient.name?.trim();
      if (!displayName) continue;

      const normalized = normalizeIngredientName(displayName);
      if (!normalized) continue;

      // The amount without the name: "500 g", "2 cups", or "" when unquantified.
      const amountText = formatIngredientLine({
        name: "",
        amount: ingredient.amount,
        unit: ingredient.unit,
      }).trim();

      const existing = byName.get(normalized);
      const source: GrocerySource = {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        amountText,
      };

      if (existing) {
        existing.sources.push(source);
      } else {
        byName.set(normalized, {
          // Keep the first spelling a cook used, not the normalized form.
          name: displayName,
          normalizedName: normalized,
          detail: "",
          sources: [source],
          coveredByPantry: ingredientCoveredBy(displayName, covered),
        });
      }
    }
  }

  for (const draft of byName.values()) {
    draft.detail = formatGroceryDetail(draft.sources);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** "500 g (Country loaf) · 2 cups (Pancakes)", skipping recipes that gave no amount. */
export function formatGroceryDetail(sources: GrocerySource[]): string {
  return sources
    .map((s) => (s.amountText ? `${s.amountText} (${s.recipeTitle})` : s.recipeTitle))
    .join(" · ");
}

export { buildCoveredSet };
