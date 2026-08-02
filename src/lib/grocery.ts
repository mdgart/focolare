import { formatIngredientLine } from "@/lib/ingredient-measure";
import { formatPlanDate, type MealType } from "@/lib/meal-plan";
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

export type ExistingGroceryRow = {
  id: string;
  normalizedName: string;
  checked: boolean;
  addedManually: boolean;
  detail: string | null;
  sources: GrocerySource[];
  coveredByPantry: boolean;
};

export type GroceryReconciliation = {
  /** Rows the plan no longer calls for. */
  doomedIds: string[];
  /** Surviving rows whose amounts, sources or pantry match have moved on. */
  refresh: { id: string; detail: string; sources: GrocerySource[]; coveredByPantry: boolean }[];
  /** Drafts with no row yet. */
  toInsert: GroceryDraft[];
};

/**
 * Work out what a rebuild should do to the rows already on the list.
 *
 * Two kinds of human input, and they earn different protection:
 *
 * - **Typed by hand** — never auto-managed. It stays whatever the plan does;
 *   the app didn't put it there and doesn't get to take it away.
 * - **Ticked off** — the tick is worth keeping, but it isn't a reason for the
 *   row itself to survive. Drop the recipe and the row goes with it, ticked or
 *   not: a list that answers "what do I buy" has no business showing an
 *   ingredient nothing in the plan needs.
 *
 * Surviving rows are updated in place rather than replaced, so ids stay stable
 * — a row being re-created under a new id mid-tap would strand the tick.
 */
export function reconcileGroceryRows(
  existing: ExistingGroceryRow[],
  drafts: GroceryDraft[],
): GroceryReconciliation {
  const draftByName = new Map(drafts.map((d) => [d.normalizedName, d]));
  const doomedIds: string[] = [];
  const refresh: GroceryReconciliation["refresh"] = [];
  const survivingNames = new Set<string>();

  for (const row of existing) {
    if (row.addedManually) {
      survivingNames.add(row.normalizedName);
      continue;
    }

    const draft = draftByName.get(row.normalizedName);
    if (!draft) {
      doomedIds.push(row.id);
      continue;
    }

    survivingNames.add(row.normalizedName);
    const moved =
      row.detail !== draft.detail ||
      row.coveredByPantry !== draft.coveredByPantry ||
      JSON.stringify(row.sources) !== JSON.stringify(draft.sources);
    if (moved) {
      refresh.push({
        id: row.id,
        detail: draft.detail,
        sources: draft.sources,
        coveredByPantry: draft.coveredByPantry,
      });
    }
  }

  return {
    doomedIds,
    refresh,
    toInsert: drafts.filter((d) => !survivingNames.has(d.normalizedName)),
  };
}

export type IngredientLine = {
  name: string;
  /** "500 g", or "" when the recipe gave no amount. */
  amountText: string;
  coveredByPantry: boolean;
};

export type MealIngredients = {
  date: string;
  meal: MealType;
  recipeId: string;
  recipeTitle: string;
  /** Empty when the recipe lists no ingredients at all. */
  lines: IngredientLine[];
};

/**
 * One meal's ingredients, exactly as its recipe wrote them.
 *
 * Nothing is merged or renamed — this is the recipe read back, with pantry
 * matches flagged so it lines up with what the shopping list set aside.
 */
export function buildIngredientLines(
  recipe: RecipeForGrocery,
  covered: Set<string>,
): IngredientLine[] {
  const lines: IngredientLine[] = [];
  for (const ingredient of recipe.ingredients ?? []) {
    const name = ingredient.name?.trim();
    if (!name) continue;
    lines.push({
      name,
      amountText: formatIngredientLine({
        name: "",
        amount: ingredient.amount,
        unit: ingredient.unit,
      }).trim(),
      coveredByPantry: ingredientCoveredBy(name, covered),
    });
  }
  return lines;
}

/**
 * Split the list into day headings, without splitting the items themselves.
 *
 * An ingredient two days want stays **one row**, filed under the first day that
 * needs it — that's the day it has to be in the house by, and repeating it under
 * every day is how a list talks you into buying it twice. Its other days are
 * shown on the row instead. Items with no day (hand-typed, or whose recipe has
 * left the plan) collect at the end rather than being dropped.
 */
export function groupByFirstDayNeeded<T extends { neededOn: string[] }>(
  items: T[],
): { date: string | null; items: T[] }[] {
  const byDate = new Map<string, T[]>();
  const undated: T[] = [];

  for (const item of items) {
    const first = item.neededOn[0];
    if (!first) {
      undated.push(item);
      continue;
    }
    byDate.set(first, [...(byDate.get(first) ?? []), item]);
  }

  // 'YYYY-MM-DD' sorts chronologically as plain strings.
  const groups: { date: string | null; items: T[] }[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, dayItems]) => ({ date, items: dayItems }));

  if (undated.length > 0) groups.push({ date: null, items: undated });
  return groups;
}

/**
 * "also Sun 2 Aug", or a count once naming every day gets long.
 *
 * The arrow around `formatPlanDate` is load-bearing: passing it straight to
 * `.map` hands it the array index as its `locale` argument, which quietly falls
 * back to the runtime's default locale — one thing on the server, another in the
 * browser, i.e. a hydration mismatch.
 */
export function alsoNeededLabel(neededOn: string[]): string | null {
  const rest = neededOn.slice(1);
  if (rest.length === 0) return null;
  if (rest.length <= 2) return `also ${rest.map((d) => formatPlanDate(d)).join(", ")}`;
  return `also ${rest.length} more days`;
}

export { buildCoveredSet };
