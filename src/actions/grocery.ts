"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groceryItem, mealPlan, mealSlot, pantryStaple, planOnHandItem, recipe } from "@/db/schema";
import { buildCoveredSet, buildGroceryDrafts, type RecipeForGrocery } from "@/lib/grocery";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { getServerSession } from "@/lib/session";

export type GroceryItemRow = {
  id: string;
  name: string;
  detail: string | null;
  checked: boolean;
  addedManually: boolean;
  coveredByPantry: boolean;
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

export async function listGroceryItems(planId: string): Promise<GroceryItemRow[]> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return [];
  return db
    .select({
      id: groceryItem.id,
      name: groceryItem.name,
      detail: groceryItem.detail,
      checked: groceryItem.checked,
      addedManually: groceryItem.addedManually,
      coveredByPantry: groceryItem.coveredByPantry,
    })
    .from(groceryItem)
    .where(eq(groceryItem.planId, planId))
    .orderBy(asc(groceryItem.name));
}

/**
 * Rebuild the list from whatever the plan currently contains.
 *
 * Regeneration is destructive by design — remove a recipe and its ingredients
 * should go — but it must never lose human input. Rows that were ticked off or
 * typed in by hand survive; only untouched auto-generated rows are replaced.
 */
export async function regenerateGroceryListAction(
  planId: string,
): Promise<{ items: GroceryItemRow[] } | { error: string }> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return { error: guard.error };

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

  const [staples, onHand] = await Promise.all([
    db
      .select({ name: pantryStaple.name })
      .from(pantryStaple)
      .where(eq(pantryStaple.userId, guard.userId)),
    db
      .select({ name: planOnHandItem.name })
      .from(planOnHandItem)
      .where(eq(planOnHandItem.planId, planId)),
  ]);

  const covered = buildCoveredSet([...staples, ...onHand].map((r) => r.name));
  const drafts = buildGroceryDrafts(recipes, covered);

  const existing = await db
    .select({
      id: groceryItem.id,
      normalizedName: groceryItem.normalizedName,
      checked: groceryItem.checked,
      addedManually: groceryItem.addedManually,
    })
    .from(groceryItem)
    .where(eq(groceryItem.planId, planId));

  const keep = existing.filter((e) => e.checked || e.addedManually);
  const keptNames = new Set(keep.map((e) => e.normalizedName));
  const disposable = existing.filter((e) => !e.checked && !e.addedManually).map((e) => e.id);

  if (disposable.length > 0) {
    await db.delete(groceryItem).where(inArray(groceryItem.id, disposable));
  }

  const toInsert = drafts
    .filter((d) => !keptNames.has(d.normalizedName))
    .map((d) => ({
      planId,
      name: d.name,
      normalizedName: d.normalizedName,
      detail: d.detail,
      sources: d.sources,
      coveredByPantry: d.coveredByPantry,
    }));

  if (toInsert.length > 0) await db.insert(groceryItem).values(toInsert);

  revalidatePath(`/plan/${planId}`);
  return { items: await listGroceryItems(planId) };
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

/** Plain text for copying, printing or sharing to a notes app. */
export async function groceryListAsText(planId: string): Promise<string> {
  const guard = await requirePlanOwner(planId);
  if (!guard.ok) return "";

  const items = await listGroceryItems(planId);
  const needed = items.filter((i) => !i.coveredByPantry);
  const haveAlready = items.filter((i) => i.coveredByPantry);

  const lines = [`${guard.plan.title} — shopping list`, ""];
  for (const i of needed) {
    lines.push(`${i.checked ? "[x]" : "[ ]"} ${i.name}${i.detail ? ` — ${i.detail}` : ""}`);
  }
  if (haveAlready.length > 0) {
    lines.push("", "Already in your pantry:");
    for (const i of haveAlready) lines.push(`- ${i.name}`);
  }
  return lines.join("\n");
}
