import { nameVariants } from "@/lib/normalize-ingredient";
import { formatNumber } from "@/lib/scale-amount";

/**
 * Reading an ingredient in the other measuring system.
 *
 * Three kinds of conversion, and only the first two are arithmetic:
 *
 *   - **weight to weight** (g ↔ oz) and **volume to volume** (ml ↔ cups) are
 *     fixed ratios and always safe.
 *   - **volume to weight** needs to know what the stuff *is*: a cup of flour is
 *     125 g, a cup of honey is 340 g. That comes from a hand-written table, and
 *     an ingredient the table doesn't know is left exactly as written.
 *
 * The refusal is the point, as everywhere else amounts are touched. A cup of an
 * unknown ingredient converted with a guessed density is a cake that doesn't
 * rise, and nothing on screen would say why.
 */

export type MeasureSystem = "metric" | "us";

type UnitKind = "weight" | "volume";

type UnitSpec = {
  /** Canonical label to print. */
  label: string;
  kind: UnitKind;
  /** Grams for weights, millilitres for volumes. */
  base: number;
  system: MeasureSystem;
};

/** US customary, since that's what "volumetric" means in this app's recipes. */
const UNITS: Record<string, UnitSpec> = {
  // Metric weight
  g: { label: "g", kind: "weight", base: 1, system: "metric" },
  kg: { label: "kg", kind: "weight", base: 1000, system: "metric" },
  // Metric volume
  ml: { label: "ml", kind: "volume", base: 1, system: "metric" },
  l: { label: "l", kind: "volume", base: 1000, system: "metric" },
  // US weight
  oz: { label: "oz", kind: "weight", base: 28.3495, system: "us" },
  lb: { label: "lb", kind: "weight", base: 453.592, system: "us" },
  // US volume
  tsp: { label: "tsp", kind: "volume", base: 4.92892, system: "us" },
  tbsp: { label: "tbsp", kind: "volume", base: 14.7868, system: "us" },
  cup: { label: "cups", kind: "volume", base: 236.588, system: "us" },
  "fl oz": { label: "fl oz", kind: "volume", base: 29.5735, system: "us" },
};

/** The many ways cooks write each unit. */
const ALIASES: Record<string, keyof typeof UNITS> = {
  g: "g", gram: "g", grams: "g", gr: "g", gs: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml", cc: "ml",
  l: "l", liter: "l", litre: "l", liters: "l", litres: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp", t: "tsp",
  tbsp: "tbsp", tbsps: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", T: "tbsp",
  cup: "cup", cups: "cup", c: "cup",
};

/**
 * Grams in one US cup.
 *
 * Hand-written, and only for ingredients where the figure is well established.
 * The rule for adding a row is the same as the substitution table's: it has to
 * be something a reference would print, not something inferred from a similar
 * ingredient. Flours especially are *not* interchangeable — almond flour is
 * nowhere near plain flour, which is why both are listed rather than one
 * standing in for the other.
 */
const GRAMS_PER_CUP: { names: string[]; grams: number; liquid?: boolean }[] = [
  { liquid: true, names: ["water"], grams: 236 },
  { liquid: true, names: ["milk", "whole milk", "buttermilk"], grams: 244 },
  { liquid: true, names: ["double cream", "heavy cream", "single cream"], grams: 238 },
  { liquid: true, names: ["yoghurt", "yogurt", "greek yoghurt"], grams: 245 },
  { names: ["flour", "plain flour", "all-purpose flour", "bread flour", "00 flour"], grams: 125 },
  { names: ["wholemeal flour", "whole wheat flour"], grams: 130 },
  { names: ["almond flour", "ground almonds"], grams: 96 },
  { names: ["cornflour", "cornstarch"], grams: 128 },
  { names: ["sugar", "granulated sugar", "caster sugar", "white sugar"], grams: 200 },
  { names: ["brown sugar"], grams: 213 },
  { names: ["icing sugar", "powdered sugar", "confectioners sugar"], grams: 120 },
  { names: ["butter"], grams: 227 },
  { liquid: true, names: ["olive oil", "vegetable oil", "sunflower oil", "oil"], grams: 216 },
  { liquid: true, names: ["honey"], grams: 340 },
  { liquid: true, names: ["maple syrup"], grams: 322 },
  { names: ["rice"], grams: 185 },
  { names: ["rolled oats", "oats"], grams: 90 },
  { names: ["cocoa powder", "cocoa"], grams: 85 },
  { names: ["salt", "fine salt", "table salt"], grams: 273 },
  { names: ["breadcrumbs"], grams: 108 },
  { names: ["parmesan", "grated parmesan"], grams: 100 },
];

const BY_VARIANT = new Map<string, { grams: number; liquid: boolean }>();
for (const row of GRAMS_PER_CUP) {
  for (const name of row.names) {
    for (const variant of nameVariants(name)) {
      if (!BY_VARIANT.has(variant)) BY_VARIANT.set(variant, { grams: row.grams, liquid: Boolean(row.liquid) });
    }
  }
}

function tableRowFor(ingredientName: string): { grams: number; liquid: boolean } | null {
  for (const variant of nameVariants(ingredientName)) {
    const hit = BY_VARIANT.get(variant);
    if (hit) return hit;
  }
  return null;
}

/** Grams per millilitre for an ingredient, or null when the table doesn't know it. */
export function densityFor(ingredientName: string): number | null {
  const row = tableRowFor(ingredientName);
  return row ? row.grams / UNITS.cup!.base : null;
}

export function resolveUnit(raw: string | undefined | null): UnitSpec | null {
  const text = raw?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  if (!text) return null;
  const key = ALIASES[text] ?? ALIASES[text.replace(/s$/, "")];
  return key ? UNITS[key]! : null;
}

/** The unit to land on when converting into a system, given what kind it is. */
function targetUnit(kind: UnitKind, system: MeasureSystem, baseAmount: number): UnitSpec {
  if (system === "metric") {
    if (kind === "weight") return baseAmount >= 1000 ? UNITS.kg! : UNITS.g!;
    return baseAmount >= 1000 ? UNITS.l! : UNITS.ml!;
  }
  if (kind === "weight") return baseAmount >= UNITS.lb!.base ? UNITS.lb! : UNITS.oz!;
  // Below a quarter cup, spoons read better than a fraction of a cup.
  if (baseAmount >= UNITS.cup!.base / 4) return UNITS.cup!;
  return baseAmount >= UNITS.tbsp!.base ? UNITS.tbsp! : UNITS.tsp!;
}

export type Converted = {
  amount: string;
  unit: string;
};

/**
 * One ingredient line in the requested system, or null to leave it as written.
 *
 * Null is a real answer and the common one: no unit to work from, an amount
 * that isn't a number, already in the right system, or a solid whose density
 * the table doesn't know. Callers show the original rather than a guess.
 *
 * Which unit it lands on follows how cooks actually write things: metric wants
 * grams for solids and millilitres for liquids, US wants cups and spoons for
 * both. Crossing between weight and volume is the step that needs the density,
 * so it only happens for ingredients in the table.
 */
export function convertIngredient(
  ing: { amount?: string; unit?: string; name: string },
  to: MeasureSystem,
  amountValue: number | null,
): Converted | null {
  const from = resolveUnit(ing.unit);
  if (!from || amountValue == null || !Number.isFinite(amountValue) || amountValue <= 0) return null;
  if (from.system === to) return null;

  const row = tableRowFor(ing.name);
  const wantKind: UnitKind = to === "metric" ? (row?.liquid ? "volume" : "weight") : "volume";
  const inBase = amountValue * from.base;

  if (from.kind === wantKind) {
    const target = targetUnit(wantKind, to, inBase);
    return { amount: formatNumber(inBase / target.base), unit: target.label };
  }

  // Crossing weight and volume is the only conversion that can be wrong.
  if (!row) {
    // No density: fall back to the same kind of measure, which is still exact.
    const target = targetUnit(from.kind, to, inBase);
    return { amount: formatNumber(inBase / target.base), unit: target.label };
  }

  const density = row.grams / UNITS.cup!.base;
  const converted = from.kind === "volume" ? inBase * density : inBase / density;
  const target = targetUnit(wantKind, to, converted);
  return { amount: formatNumber(converted / target.base), unit: target.label };
}
