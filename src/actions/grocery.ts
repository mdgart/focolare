"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groceryItem, mealPlan, mealSlot, recipe } from "@/db/schema";
import {
  alsoNeededLabel,
  buildIngredientLines,
  groupByFirstDayNeeded,
  type MealIngredients,
} from "@/lib/grocery";
import { coveredSetForPlan, rebuildGroceryList } from "@/lib/grocery-sync";
import { formatPlanDate, type MealType } from "@/lib/meal-plan";
import { ingredientCoveredBy, normalizeIngredientName } from "@/lib/normalize-ingredient";
import { getServerSession } from "@/lib/session";
import { addPantryStaplesAction } from "@/actions/pantry";

export type GroceryItemRow = {
  id: string;
  name: string;
  detail: string | null;
  checked: boolean;
  addedManually: boolean;
  coveredByPantry: boolean;
  /**
   * Every plan day whose recipes call for this, earliest first. Empty for
   * hand-typed rows and for rows whose recipe has since left the plan.
   */
  neededOn: string[];
};

async function requirePlanOwner(planId: string) {
  const session = await getServerSession();
  if (!session?.user?.id) return { ok: false as const, error: "Sign in to plan meals." };
  const [plan] = await db.select().from(mealPlan).where(eq(mealPlan.id, planId)).limit(1);
  if (!plan || plan.userId !== session.user.id) {
    return { ok: false as const, error: "Plan not found." };
  }
  return { ok: true as const, plan, userId: session.user.id };
}

/**
 * The list, with each row tagged by the days its recipes are cooked.
 *
 * The days come from the row's `sources` joined back to the plan's slots, so an
 * ingredient two recipes want carries both their days. It stays **one row** —
 * the list is what you carry round a shop, and splitting "flour" into three
 * rows is how you come home with three bags. The days are for grouping and for
 * knowing when you need it by, not for buying it again.
 */
export async function listGroceryItems(planId: string): Promise<GroceryItemRow[]> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return [];

  const [rows, slots] = await Promise.all([
    db
      .select({
        id: groceryItem.id,
        name: groceryItem.name,
        detail: groceryItem.detail,
        checked: groceryItem.checked,
        addedManually: groceryItem.addedManually,
        coveredByPantry: groceryItem.coveredByPantry,
        sources: groceryItem.sources,
      })
      .from(groceryItem)
      .where(eq(groceryItem.planId, planId))
      .orderBy(asc(groceryItem.name)),
    db
      .select({ recipeId: mealSlot.recipeId, date: mealSlot.date })
      .from(mealSlot)
      .where(eq(mealSlot.planId, planId)),
  ]);

  const datesByRecipe = new Map<string, string[]>();
  for (const slot of slots) {
    if (!slot.recipeId) continue;
    datesByRecipe.set(slot.recipeId, [...(datesByRecipe.get(slot.recipeId) ?? []), slot.date]);
  }

  return rows.map(({ sources, ...row }) => {
    const dates = new Set<string>();
    for (const source of sources ?? []) {
      for (const date of datesByRecipe.get(source.recipeId) ?? []) dates.add(date);
    }
    // 'YYYY-MM-DD' sorts chronologically as plain strings.
    return { ...row, neededOn: [...dates].sort() };
  });
}

/**
 * Rebuild the list on demand.
 *
 * The list already tracks the plan on its own — this is the manual escape hatch
 * for everything else that can go stale, chiefly pantry changes made on another
 * page while this one was open.
 */
export async function regenerateGroceryListAction(
  planId: string,
): Promise<{ items: GroceryItemRow[] } | { error: string }> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return { error: guard.error };

  await rebuildGroceryList(planId, guard.userId);

  revalidatePath(`/plan/${planId}`);
  return { items: await listGroceryItems(planId) };
}

/**
 * What one planned meal needs.
 *
 * Read live from the recipe rather than from `grocery_item`: the shopping list
 * is a working document that gets ticked off, edited and rebuilt, while this has
 * to match the recipe as it stands. Pantry coverage uses the same set as the
 * list, so the two agree on what you already have.
 */
export async function listMealIngredientsAction(input: {
  planId: string;
  date: string;
  meal: MealType;
}): Promise<{ meal: MealIngredients } | { error: string }> {
  const guard = await requirePlanOwner(input.planId);
  if (!guard.ok) return { error: guard.error };

  const [slot] = await db
    .select({
      recipeId: mealSlot.recipeId,
      recipeTitle: recipe.title,
      ingredients: recipe.ingredients,
    })
    .from(mealSlot)
    .leftJoin(recipe, eq(mealSlot.recipeId, recipe.id))
    .where(
      and(
        eq(mealSlot.planId, input.planId),
        eq(mealSlot.date, input.date),
        eq(mealSlot.meal, input.meal),
      ),
    )
    .limit(1);

  if (!slot?.recipeId || slot.recipeTitle === null) {
    return { error: "There's no recipe on that meal yet." };
  }

  const covered = await coveredSetForPlan(input.planId, guard.userId);

  return {
    meal: {
      date: input.date,
      meal: input.meal,
      recipeId: slot.recipeId,
      recipeTitle: slot.recipeTitle,
      lines: buildIngredientLines(
        { id: slot.recipeId, title: slot.recipeTitle, ingredients: slot.ingredients ?? [] },
        covered,
      ),
    },
  };
}

export async function toggleGroceryItemAction(
  id: string,
): Promise<{ checked: boolean } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to plan meals." };

  // Ownership is checked through the plan, since grocery rows have no user column.
  const [row] = await db
    .select({ id: groceryItem.id, planId: groceryItem.planId, checked: groceryItem.checked })
    .from(groceryItem)
    .innerJoin(mealPlan, eq(groceryItem.planId, mealPlan.id))
    .where(and(eq(groceryItem.id, id), eq(mealPlan.userId, session.user.id)))
    .limit(1);
  if (!row) return { error: "Item not found." };

  await db.update(groceryItem).set({ checked: !row.checked }).where(eq(groceryItem.id, id));
  revalidatePath(`/plan/${row.planId}`);
  return { checked: !row.checked };
}

export async function addManualGroceryItemAction(input: {
  planId: string;
  name: string;
}): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlanOwner(input.planId);
  if (!guard.ok) return { error: guard.error };

  const name = input.name.trim();
  if (!name) return { error: "Type something to add." };

  await db.insert(groceryItem).values({
    planId: input.planId,
    name,
    normalizedName: normalizeIngredientName(name),
    detail: null,
    sources: [],
    addedManually: true,
  });

  revalidatePath(`/plan/${input.planId}`);
  return { ok: true };
}

/**
 * "I always have this" — promote a row on the list to a pantry staple.
 *
 * The matcher is deliberately literal, so the cheapest fix for a name it can't
 * be expected to know ("passata", "gochujang") is the human saying so once. The
 * staple is saved under the spelling the recipe used, and coverage is recomputed
 * across the whole plan, not just this row: adding "milk" should also set aside
 * the "whole milk" three days later.
 *
 * Hand-typed rows are left alone. Someone who typed an item onto this list
 * wants it on this list, whatever the pantry now says.
 */
export async function keepGroceryItemAsStapleAction(input: {
  planId: string;
  itemId: string;
}): Promise<{ items: GroceryItemRow[] } | { error: string }> {
  const guard = await requirePlanOwner(input.planId);
  if (!guard.ok) return { error: guard.error };

  const [row] = await db
    .select({ name: groceryItem.name })
    .from(groceryItem)
    .where(and(eq(groceryItem.id, input.itemId), eq(groceryItem.planId, input.planId)))
    .limit(1);
  if (!row) return { error: "Item not found." };

  const added = await addPantryStaplesAction([row.name]);
  if ("error" in added) return { error: added.error };

  const covered = await coveredSetForPlan(input.planId, guard.userId);
  const rows = await db
    .select({
      id: groceryItem.id,
      name: groceryItem.name,
      coveredByPantry: groceryItem.coveredByPantry,
      addedManually: groceryItem.addedManually,
    })
    .from(groceryItem)
    .where(eq(groceryItem.planId, input.planId));

  // Only false -> true: a new staple can add coverage, never take it away.
  const nowCovered = rows
    .filter((r) => !r.addedManually && !r.coveredByPantry && ingredientCoveredBy(r.name, covered))
    .map((r) => r.id);

  if (nowCovered.length > 0) {
    await db
      .update(groceryItem)
      .set({ coveredByPantry: true })
      .where(inArray(groceryItem.id, nowCovered));
  }

  revalidatePath(`/plan/${input.planId}`);
  return { items: await listGroceryItems(input.planId) };
}

export async function removeGroceryItemAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to plan meals." };

  const [row] = await db
    .select({ id: groceryItem.id, planId: groceryItem.planId })
    .from(groceryItem)
    .innerJoin(mealPlan, eq(groceryItem.planId, mealPlan.id))
    .where(and(eq(groceryItem.id, id), eq(mealPlan.userId, session.user.id)))
    .limit(1);
  if (!row) return { error: "Item not found." };

  await db.delete(groceryItem).where(eq(groceryItem.id, id));
  revalidatePath(`/plan/${row.planId}`);
  return { ok: true };
}

/**
 * Plain text for copying, printing or sharing to a notes app.
 *
 * Laid out like the list on screen — same day grouping, same one row per
 * ingredient — so what someone pastes into a message matches what they were
 * looking at when they pressed the button.
 */
export async function groceryListAsText(planId: string): Promise<string> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return "";

  const items = await listGroceryItems(planId);
  const needed = items.filter((i) => !i.coveredByPantry);
  const haveAlready = items.filter((i) => i.coveredByPantry);

  const lines = ["Shopping list"];
  for (const group of groupByFirstDayNeeded(needed)) {
    lines.push("", group.date ? `For ${formatPlanDate(group.date)}` : "Anything else");
    for (const i of group.items) {
      const also = alsoNeededLabel(i.neededOn);
      lines.push(
        `${i.checked ? "[x]" : "[ ]"} ${i.name}${i.detail ? ` — ${i.detail}` : ""}${
          also ? ` (${also})` : ""
        }`,
      );
    }
  }
  if (needed.length === 0) lines.push("", "Nothing to buy.");
  if (haveAlready.length > 0) {
    lines.push("", "Already in — not on the list:");
    for (const i of haveAlready) lines.push(`- ${i.name}`);
  }
  return lines.join("\n");
}
