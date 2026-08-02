import type { MealType } from "@/lib/meal-plan";

/**
 * What a recipe is *for* — breakfast, dinner, dessert.
 *
 * Separate from the plan's three slots on purpose. A plan has breakfast, lunch
 * and dinner to fill; a recipe belongs to a wider set of occasions, and brunch
 * genuinely sits across two of them. Keeping the two vocabularies apart means
 * neither has to be bent to fit the other.
 *
 * Always optional. An untagged recipe means "nobody said", not "suits nothing",
 * and is treated accordingly everywhere.
 */
export const MEAL_TAGS = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snack",
  "dessert",
] as const;

export type MealTag = (typeof MEAL_TAGS)[number];

export const MEAL_TAG_LABEL: Record<MealTag, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
};

/**
 * Which plan slots each tag will answer for.
 *
 * Brunch covers breakfast and lunch, because that's what brunch is. Snacks and
 * desserts map to nothing: they're real things to cook, but "what am I making
 * for dinner" is not answered by a tray of brownies. A recipe tagged only
 * dessert therefore stops being *suggested* for a meal — it's still findable
 * through the picker's search tab, which doesn't filter.
 */
const TAG_FILLS_SLOT: Record<MealTag, MealType[]> = {
  breakfast: ["breakfast"],
  brunch: ["breakfast", "lunch"],
  lunch: ["lunch"],
  dinner: ["dinner"],
  snack: [],
  dessert: [],
};

export function isMealTag(value: string): value is MealTag {
  return (MEAL_TAGS as readonly string[]).includes(value);
}

/** Only the recognised tags, deduplicated and in the canonical order. */
export function normalizeMealTags(values: readonly string[] | null | undefined): MealTag[] {
  if (!values?.length) return [];
  const found = new Set(values.filter(isMealTag));
  return MEAL_TAGS.filter((tag) => found.has(tag));
}

/**
 * Would this recipe answer for that slot?
 *
 * **No tags means yes.** Most recipes have never been tagged, and treating
 * silence as a "no" would empty the suggestion list — the same reason an
 * unstated cooking time doesn't disqualify a recipe. A tag that *is* set is
 * taken at its word: tag your loaf as breakfast and it stops turning up for
 * dinner, which is the entire point of the feature.
 */
export function suitsMealSlot(tags: readonly string[] | null | undefined, meal: MealType): boolean {
  const known = normalizeMealTags(tags);
  if (known.length === 0) return true;
  return known.some((tag) => TAG_FILLS_SLOT[tag].includes(meal));
}

/** True when the recipe was explicitly tagged for this slot, rather than merely allowed. */
export function isTaggedForMeal(tags: readonly string[] | null | undefined, meal: MealType): boolean {
  return normalizeMealTags(tags).some((tag) => TAG_FILLS_SLOT[tag].includes(meal));
}
