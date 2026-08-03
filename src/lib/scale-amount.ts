import { repairIngredientParts } from "@/lib/ingredient-measure";

/**
 * Scaling the amounts in a recipe.
 *
 * Amounts are free text — "500", "½", "2-3", "a splash", "1 × 28 oz tin" — so
 * this parses what it can recognise and refuses the rest. An amount it cannot
 * read is returned untouched and flagged, for the UI to mark as needing a human
 * eye. That refusal is the whole design: doubling "a splash" to "2 splashes" or
 * silently leaving it at "a splash" without saying so are both worse than
 * admitting the number isn't scalable.
 *
 * Units are never converted. 1000 g stays 1000 g rather than becoming 1 kg —
 * unit conversion is a different problem with its own ways of being wrong.
 */

const VULGAR: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** Written back out largest-first, so 0.75 prefers ¾ over ⅜ + ⅜. */
const NICE_FRACTIONS: [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.375, "⅜"],
  [0.5, "½"],
  [0.625, "⅝"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

/** How far off a nice fraction a value may be and still be written as one. */
const FRACTION_TOLERANCE = 0.02;

/** One number from an amount string, or null when it isn't one. Exported so the
 * unit converter reads amounts exactly the way scaling does. */
export function parseNumber(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  // "1½" or "½"
  const withVulgar = text.match(/^(\d*)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/u);
  if (withVulgar) return (Number(withVulgar[1]) || 0) + VULGAR[withVulgar[2]!]!;

  // "1 1/2"
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  // "3/4"
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  // "500", "2.5", "2,5"
  const plain = text.match(/^(\d+(?:[.,]\d+)?)$/);
  if (plain) return Number(plain[1]!.replace(",", "."));

  return null;
}

/** A number back into the vocabulary recipes are written in. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";

  // Precision follows magnitude, because that's how kitchen scales work.
  // A third of a gram means nothing at 1333 g; at 12.5 g of yeast it does.
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value * 10) / 10);

  const whole = Math.floor(value);
  const remainder = value - whole;

  if (remainder < FRACTION_TOLERANCE) return String(whole);
  if (1 - remainder < FRACTION_TOLERANCE) return String(whole + 1);

  for (const [fraction, glyph] of NICE_FRACTIONS) {
    if (Math.abs(remainder - fraction) <= FRACTION_TOLERANCE) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }

  // Nothing tidy to say: two decimals at most, trailing zeros trimmed.
  return String(Math.round(value * 100) / 100);
}

export type ScaledAmount = {
  text: string;
  /** False when the amount could not be read, and so was left exactly as written. */
  scaled: boolean;
};

/**
 * Multiply an amount, keeping ranges as ranges.
 *
 * A factor of 1 is a no-op that still counts as scaled — there's nothing to
 * flag when nothing needed changing.
 */
export function scaleAmountText(amount: string | undefined | null, factor: number): ScaledAmount {
  const text = amount?.trim() ?? "";
  if (!text) return { text: "", scaled: true };
  if (!Number.isFinite(factor) || factor <= 0) return { text, scaled: false };
  if (factor === 1) return { text, scaled: true };

  // "2-3", "2–3", "2 to 3": scale both ends and keep the separator.
  const range = text.match(/^(.+?)\s*(-|–|—|to)\s*(.+)$/);
  if (range) {
    const low = parseNumber(range[1]!);
    const high = parseNumber(range[3]!);
    if (low !== null && high !== null) {
      const separator = range[2] === "to" ? " to " : range[2]!;
      return {
        text: `${formatNumber(low * factor)}${separator}${formatNumber(high * factor)}`,
        scaled: true,
      };
    }
    return { text, scaled: false };
  }

  const value = parseNumber(text);
  if (value === null) return { text, scaled: false };
  return { text: formatNumber(value * factor), scaled: true };
}

export type RecipeIngredient = { amount?: string; unit?: string; name: string };

export type ScaledIngredient = RecipeIngredient & {
  /** True when this line has an amount that couldn't be read, so wasn't scaled. */
  needsEye: boolean;
};

/** Every ingredient at a new scale, each flagged if its amount defeated the parser. */
export function scaleIngredients(
  ingredients: RecipeIngredient[],
  factor: number,
): ScaledIngredient[] {
  return ingredients.map((raw) => {
    // Older rows split "1 1/2" across amount and unit; repair before scaling,
    // or the half is left stranded beside a scaled amount.
    const ingredient = repairIngredientParts(raw);
    const scaled = scaleAmountText(ingredient.amount, factor);
    return {
      ...ingredient,
      amount: scaled.text || ingredient.amount,
      // An ingredient with no amount at all ("salt, to taste") isn't a problem
      // to flag — there was never a quantity to get wrong.
      needsEye: Boolean(ingredient.amount?.trim()) && !scaled.scaled,
    };
  });
}

/**
 * The factor that takes one ingredient from its written amount to a target.
 *
 * This is how "I have 700 g of flour, what does the rest become?" works — the
 * baker's-percentage way round. Null when the ingredient's own amount can't be
 * read, since there's nothing to measure the target against.
 */
export function factorForTargetAmount(
  writtenAmount: string | undefined | null,
  target: number,
): number | null {
  const text = writtenAmount?.trim() ?? "";
  if (!text || !Number.isFinite(target) || target <= 0) return null;

  // A range scales off its upper end, matching how durations are read elsewhere.
  const range = text.match(/^(.+?)\s*(?:-|–|—|to)\s*(.+)$/);
  const base = range ? parseNumber(range[2]!) : parseNumber(text);
  if (base === null || base <= 0) return null;

  return target / base;
}
