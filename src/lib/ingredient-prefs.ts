import { normalizeIngredientName, nameVariants } from "@/lib/normalize-ingredient";
import { parseNumber, scaleIngredients, type RecipeIngredient } from "@/lib/scale-amount";
import { convertIngredient, type MeasureSystem } from "@/lib/unit-convert";

/**
 * How one cook wants to read one recipe.
 *
 * Scaling, the measuring system, and any substitutions they've chosen. Held per
 * user per recipe and applied everywhere the ingredients appear — the recipe
 * page and cook mode both render from here, so what you set up while reading is
 * what you see while cooking.
 *
 * **A substitution never rewrites an amount.** Ratios are prose — "¾ of the
 * butter weight", "1 cup milk + 1 tbsp acid", "3 tsp per 1 tsp" — and turning
 * those into numbers means guessing. The original amount stays on the line and
 * the swap is shown beside it, which is both honest and what a cook actually
 * needs: the quantity they own, and the rule for converting it.
 */

export type ChosenSubstitution = {
  /** The ingredient being replaced, as the recipe wrote it. */
  forIngredient: string;
  use: string;
  ratio: string;
};

export type IngredientPrefs = {
  /** 100 means as written. */
  scalePercent: number;
  /** "recipe" leaves the units exactly as the author wrote them. */
  unitSystem: "recipe" | MeasureSystem;
  substitutions: ChosenSubstitution[];
};

export const DEFAULT_PREFS: IngredientPrefs = {
  scalePercent: 100,
  unitSystem: "recipe",
  substitutions: [],
};

/** True when the cook has changed anything worth offering to undo. */
export function prefsAreCustomised(prefs: IngredientPrefs): boolean {
  return (
    prefs.scalePercent !== 100 ||
    prefs.unitSystem !== "recipe" ||
    prefs.substitutions.length > 0
  );
}

/** Tolerant of anything already stored, since this comes back out of jsonb. */
export function normalizePrefs(raw: unknown): IngredientPrefs {
  const value = (raw ?? {}) as Partial<IngredientPrefs>;

  const scale = Number(value.scalePercent);
  const scalePercent =
    Number.isFinite(scale) && scale >= 10 && scale <= 1000 ? Math.round(scale) : 100;

  const unitSystem =
    value.unitSystem === "metric" || value.unitSystem === "us" ? value.unitSystem : "recipe";

  const substitutions = Array.isArray(value.substitutions)
    ? value.substitutions
        .filter(
          (s): s is ChosenSubstitution =>
            Boolean(s) && typeof s.forIngredient === "string" && typeof s.use === "string",
        )
        .map((s) => ({
          forIngredient: s.forIngredient,
          use: s.use,
          ratio: typeof s.ratio === "string" ? s.ratio : "",
        }))
        .slice(0, 40)
    : [];

  return { scalePercent, unitSystem, substitutions };
}

/** One ingredient line as it should be read, given the cook's preferences. */
export type DisplayIngredient = RecipeIngredient & {
  /** The amount couldn't be parsed, so it was left exactly as written. */
  needsEye: boolean;
  /** The units were changed from what the recipe said. */
  converted: boolean;
  /** Set when the cook chose to swap this ingredient out. */
  swap: { use: string; ratio: string } | null;
};

/** Matches a chosen substitution to a line the same way the pantry matcher does. */
function swapFor(
  name: string,
  substitutions: readonly ChosenSubstitution[],
): { use: string; ratio: string } | null {
  if (substitutions.length === 0) return null;
  const variants = new Set(nameVariants(name));
  for (const s of substitutions) {
    if (nameVariants(s.forIngredient).some((v) => variants.has(v))) {
      return { use: s.use, ratio: s.ratio };
    }
  }
  return null;
}

/**
 * The ingredient list as this cook wants to read it.
 *
 * Order matters: repair the stored parts, scale, then convert. Scaling before
 * converting keeps the arithmetic in the units the recipe was written in, which
 * is where its numbers make sense.
 */
export function applyPrefs(
  ingredients: readonly RecipeIngredient[],
  prefs: IngredientPrefs,
  writtenIn: MeasureSystem,
  /** Densities looked up for ingredients the curated table doesn't carry. */
  extraDensities?: ReadonlyMap<string, { grams: number; liquid: boolean }>,
): DisplayIngredient[] {
  const showIn = prefs.unitSystem === "recipe" ? null : prefs.unitSystem;
  const scaled = scaleIngredients([...ingredients], prefs.scalePercent / 100);

  return scaled.map((line) => {
    const base: DisplayIngredient = {
      ...line,
      converted: false,
      swap: swapFor(line.name, prefs.substitutions),
    };
    if (!showIn || showIn === writtenIn) return base;

    const next = convertIngredient(line, showIn, parseNumber(line.amount ?? ""), extraDensities);
    if (!next) return base;
    return { ...base, amount: next.amount, unit: next.unit, converted: true };
  });
}

/** Add or replace a swap for one ingredient; an empty `use` removes it. */
export function withSubstitution(
  prefs: IngredientPrefs,
  choice: ChosenSubstitution,
): IngredientPrefs {
  const key = normalizeIngredientName(choice.forIngredient);
  const rest = prefs.substitutions.filter(
    (s) => normalizeIngredientName(s.forIngredient) !== key,
  );
  return {
    ...prefs,
    substitutions: choice.use.trim() ? [...rest, choice] : rest,
  };
}
