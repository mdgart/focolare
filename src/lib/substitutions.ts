import { nameVariants, normalizeIngredientName } from "@/lib/normalize-ingredient";

/**
 * "I haven't got any — what else works?"
 *
 * A hand-written table rather than a model call, for the same reasons the
 * suggestion ranking is arithmetic: it has to be instant, free, and give the
 * same answer twice. It also has to be *right*. A plausible-sounding invented
 * substitution is worse than silence — someone may be swapping because of an
 * allergy, and baking punishes a bad ratio an hour later when nothing rises.
 *
 * So the rule for adding an entry: only swaps a cookbook would print, each with
 * the ratio spelled out and a note on where it falls down. When the table has
 * nothing to say it says nothing, which is an honest answer.
 *
 * Matching reuses the pantry matcher, so "whole milk" and "large eggs" find the
 * entries for milk and eggs without needing their own rows.
 */

export type Substitution = {
  /** What to use instead, as you'd write it on a shopping list. */
  use: string;
  /** How much, relative to what the recipe asked for. */
  ratio: string;
  /** Where this swap changes the result. Shown as-is; honesty beats brevity. */
  caveat?: string;
};

export type SubstitutionEntry = {
  /** Display name of the ingredient being replaced. */
  ingredient: string;
  options: Substitution[];
};

const TABLE: SubstitutionEntry[] = [
  {
    ingredient: "Buttermilk",
    options: [
      {
        use: "Milk + lemon juice or vinegar",
        ratio: "1 cup milk + 1 tbsp acid, left 10 minutes",
        caveat: "Thinner than the real thing, but it curdles and rises the same.",
      },
      { use: "Plain yoghurt", ratio: "Equal, loosened with a splash of milk" },
    ],
  },
  {
    ingredient: "Self-raising flour",
    options: [
      {
        use: "Plain flour + baking powder",
        ratio: "150 g flour + 2 tsp baking powder per 150 g",
        caveat: "Add a pinch of salt if the recipe adds none of its own.",
      },
    ],
  },
  {
    ingredient: "Baking powder",
    options: [
      {
        use: "Bicarbonate of soda + cream of tartar",
        ratio: "¼ tsp bicarb + ½ tsp cream of tartar per 1 tsp",
        caveat: "Mix and bake straight away — it starts working on contact.",
      },
    ],
  },
  {
    ingredient: "Bicarbonate of soda",
    options: [
      {
        use: "Baking powder",
        ratio: "3 tsp per 1 tsp of bicarb",
        caveat: "Only where there's already something acidic; it's a weaker lift.",
      },
    ],
  },
  {
    ingredient: "Butter",
    options: [
      { use: "Olive oil", ratio: "¾ of the butter weight", caveat: "Savoury cooking; it won't cream into cake batter." },
      { use: "Neutral oil", ratio: "¾ of the butter weight", caveat: "Fine for melted-butter recipes, not for pastry." },
    ],
  },
  {
    ingredient: "Eggs",
    options: [
      { use: "Ground flaxseed + water", ratio: "1 tbsp flax + 3 tbsp water per egg, rested 5 min", caveat: "Binds well; won't aerate a sponge or set a custard." },
      { use: "Apple sauce", ratio: "60 g per egg", caveat: "For moisture in cakes and muffins only." },
    ],
  },
  {
    ingredient: "Milk",
    options: [
      { use: "Any unsweetened plant milk", ratio: "Equal", caveat: "Oat and soya behave closest in baking." },
      { use: "Evaporated milk + water", ratio: "Half and half" },
    ],
  },
  {
    ingredient: "Double cream",
    options: [
      { use: "Milk + melted butter", ratio: "¾ milk + ¼ butter", caveat: "Pours and enriches, but will not whip." },
      { use: "Crème fraîche", ratio: "Equal", caveat: "Tangier, and less likely to split in a hot sauce." },
    ],
  },
  {
    ingredient: "Sour cream",
    options: [{ use: "Greek yoghurt", ratio: "Equal" }],
  },
  {
    ingredient: "Caster sugar",
    options: [
      { use: "Granulated sugar", ratio: "Equal, blitzed briefly", caveat: "Unblitzed it creams less well and can leave a grainy crumb." },
    ],
  },
  {
    ingredient: "Brown sugar",
    options: [
      { use: "White sugar + molasses or treacle", ratio: "200 g sugar + 1 tbsp molasses per 200 g" },
    ],
  },
  {
    ingredient: "Honey",
    options: [
      { use: "Maple syrup", ratio: "Equal" },
      { use: "Sugar", ratio: "¾ of the honey weight, plus a splash of liquid", caveat: "Bakes drier — honey holds water." },
    ],
  },
  {
    ingredient: "Fresh herbs",
    options: [
      { use: "Dried", ratio: "⅓ of the fresh amount", caveat: "Add early to cook out; fresh goes in at the end." },
    ],
  },
  {
    ingredient: "Garlic",
    options: [{ use: "Garlic powder", ratio: "⅛ tsp per clove", caveat: "Fine in a rub or a braise, flat in anything raw." }],
  },
  {
    ingredient: "Shallots",
    options: [{ use: "Onion", ratio: "Equal by weight", caveat: "Coarser and sweeter — use a little less if it's raw." }],
  },
  {
    ingredient: "Tomato passata",
    options: [
      { use: "Tinned tomatoes", ratio: "Equal, blitzed and sieved" },
      { use: "Tomato paste + water", ratio: "1 part paste to 3 parts water" },
    ],
  },
  {
    ingredient: "Stock",
    options: [
      { use: "Stock cube or bouillon + water", ratio: "As the packet says" },
      { use: "Water", ratio: "Equal", caveat: "Season harder — you're giving up the savouriness." },
    ],
  },
  {
    ingredient: "White wine",
    options: [
      { use: "Stock + a squeeze of lemon", ratio: "Equal, with 1 tsp lemon per 100 ml" },
      { use: "White wine vinegar + water", ratio: "1 part vinegar to 3 parts water" },
    ],
  },
  {
    ingredient: "Red wine",
    options: [{ use: "Beef stock + 1 tsp red wine vinegar", ratio: "Equal" }],
  },
  {
    ingredient: "Cornflour",
    options: [
      { use: "Plain flour", ratio: "2 tbsp per 1 tbsp cornflour", caveat: "Cloudier, and it needs cooking out longer." },
    ],
  },
  {
    ingredient: "Breadcrumbs",
    options: [
      { use: "Rolled oats, blitzed", ratio: "Equal" },
      { use: "Crushed crackers", ratio: "Equal", caveat: "Already salted — hold back on the seasoning." },
    ],
  },
  {
    ingredient: "Parmesan",
    options: [
      { use: "Pecorino or grana padano", ratio: "Equal", caveat: "Pecorino is sharper and saltier." },
      { use: "Nutritional yeast", ratio: "Half, to taste", caveat: "Savoury rather than cheesy; it won't melt." },
    ],
  },
  {
    ingredient: "Lemon juice",
    options: [{ use: "Lime juice, or white wine vinegar", ratio: "Equal (vinegar: ½, it's sharper)" }],
  },
  {
    ingredient: "Vanilla extract",
    options: [{ use: "Vanilla bean paste, or the seeds of a pod", ratio: "Equal (½ pod per tsp)" }],
  },
  {
    ingredient: "Yeast",
    options: [
      { use: "Instant from fresh, or the reverse", ratio: "1 g instant per 3 g fresh", caveat: "Fresh goes into the liquid; instant can go straight in the flour." },
    ],
  },
  {
    ingredient: "Mascarpone",
    options: [{ use: "Full-fat cream cheese", ratio: "Equal, slackened with a spoon of cream" }],
  },
  {
    ingredient: "Crème fraîche",
    options: [{ use: "Soured cream or Greek yoghurt", ratio: "Equal", caveat: "Yoghurt splits over high heat — take the pan off first." }],
  },
];

/** Prebuilt so a lookup is a map hit rather than a scan of the table. */
const BY_VARIANT = new Map<string, SubstitutionEntry>();
for (const entry of TABLE) {
  for (const variant of nameVariants(entry.ingredient)) {
    if (!BY_VARIANT.has(variant)) BY_VARIANT.set(variant, entry);
  }
}

/**
 * What this ingredient can be replaced with, or null when the table has nothing.
 *
 * Matching is the pantry matcher's, so grade words are stripped ("large eggs" →
 * eggs) but substance modifiers are not: "almond milk" finds nothing rather than
 * being handed cow's-milk swaps, and "smoked paprika" isn't told to use paprika.
 */
export function substitutionsFor(ingredientName: string): SubstitutionEntry | null {
  const name = normalizeIngredientName(ingredientName);
  if (!name) return null;
  for (const variant of nameVariants(ingredientName)) {
    const hit = BY_VARIANT.get(variant);
    if (hit) return hit;
  }
  return null;
}

/** Ingredient names the table can say something about, for the UI to mark up front. */
export function hasSubstitutions(ingredientName: string): boolean {
  return substitutionsFor(ingredientName) !== null;
}
