import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groceryItem, mealSlot, pantryStaple, planOnHandItem, recipe } from "@/db/schema";
import {
  buildCoveredSet,
  buildGroceryDrafts,
  reconcileGroceryRows,
  type RecipeForGrocery,
} from "@/lib/grocery";

/**
 * Keeping a plan's shopping list in step with the plan.
 *
 * Deliberately **not** a `"use server"` module: every export of one of those is
 * a POST endpoint anyone can call, and `rebuildGroceryList` takes a `userId`,
 * which would let a caller build a list against someone else's pantry. Ownership
 * is checked by the actions that call in here.
 */

/** Pantry staples plus this plan's on-hand items, as the normalized lookup set. */
export async function coveredSetForPlan(planId: string, userId: string): Promise<Set<string>> {
  const [staples, onHand] = await Promise.all([
    db.select({ name: pantryStaple.name }).from(pantryStaple).where(eq(pantryStaple.userId, userId)),
    db
      .select({ name: planOnHandItem.name })
      .from(planOnHandItem)
      .where(eq(planOnHandItem.planId, planId)),
  ]);
  return buildCoveredSet([...staples, ...onHand].map((r) => r.name));
}

/**
 * Rebuild the list from whatever the plan currently contains.
 *
 * Destructive by design — remove a recipe and its ingredients should go. What
 * survives is decided by `reconcileGroceryRows`: hand-typed rows always, ticked
 * rows only while the plan still calls for them. That's what makes it safe to
 * run automatically whenever the recipes change rather than behind a button.
 */
export async function rebuildGroceryList(planId: string, userId: string): Promise<void> {
  const slots = await db
    .select({ recipeId: mealSlot.recipeId })
    .from(mealSlot)
    .where(eq(mealSlot.planId, planId));

  const recipeIds = [...new Set(slots.map((s) => s.recipeId).filter((x): x is string => Boolean(x)))];

  const recipes: RecipeForGrocery[] = recipeIds.length
    ? (
        await db
          .select({ id: recipe.id, title: recipe.title, ingredients: recipe.ingredients })
          .from(recipe)
          .where(inArray(recipe.id, recipeIds))
      ).map((r) => ({ id: r.id, title: r.title, ingredients: r.ingredients ?? [] }))
    : [];

  const covered = await coveredSetForPlan(planId, userId);
  const drafts = buildGroceryDrafts(recipes, covered);

  const existing = await db
    .select({
      id: groceryItem.id,
      normalizedName: groceryItem.normalizedName,
      checked: groceryItem.checked,
      addedManually: groceryItem.addedManually,
      detail: groceryItem.detail,
      sources: groceryItem.sources,
      coveredByPantry: groceryItem.coveredByPantry,
    })
    .from(groceryItem)
    .where(eq(groceryItem.planId, planId));

  const { doomedIds, refresh, toInsert } = reconcileGroceryRows(existing, drafts);

  if (doomedIds.length > 0) {
    await db.delete(groceryItem).where(inArray(groceryItem.id, doomedIds));
  }

  for (const row of refresh) {
    await db
      .update(groceryItem)
      .set({ detail: row.detail, sources: row.sources, coveredByPantry: row.coveredByPantry })
      .where(eq(groceryItem.id, row.id));
  }

  if (toInsert.length > 0) {
    await db.insert(groceryItem).values(
      toInsert.map((d) => ({
        planId,
        name: d.name,
        normalizedName: d.normalizedName,
        detail: d.detail,
        sources: d.sources,
        coveredByPantry: d.coveredByPantry,
      })),
    );
  }
}
