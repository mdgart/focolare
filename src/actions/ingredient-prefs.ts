"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recipeIngredientPref } from "@/db/schema";
import {
  DEFAULT_PREFS,
  normalizePrefs,
  type IngredientPrefs,
} from "@/lib/ingredient-prefs";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";

/**
 * Reading preferences for one recipe.
 *
 * Signed-out readers get the defaults and can still change things for the page
 * view — the controls work, nothing is stored. There's no account to hang a
 * preference on and no reason to make that an error.
 */
export async function getIngredientPrefsAction(recipeId: string): Promise<IngredientPrefs> {
  const session = await getServerSession();
  if (!session?.user?.id) return DEFAULT_PREFS;

  const [row] = await db
    .select({
      scalePercent: recipeIngredientPref.scalePercent,
      unitSystem: recipeIngredientPref.unitSystem,
      substitutions: recipeIngredientPref.substitutions,
    })
    .from(recipeIngredientPref)
    .where(
      and(
        eq(recipeIngredientPref.userId, session.user.id),
        eq(recipeIngredientPref.recipeId, recipeId),
      ),
    )
    .limit(1);

  return row ? normalizePrefs(row) : DEFAULT_PREFS;
}

/**
 * Store how this cook reads this recipe.
 *
 * Saved rather than merged: the client holds the whole preference object and
 * sends it entire, so there's one writer and no chance of a scale change
 * racing a substitution and dropping it.
 *
 * Preferences that amount to "as written" delete the row instead of storing a
 * no-op, which keeps "have I customised this?" a question about existence.
 */
export async function saveIngredientPrefsAction(input: {
  recipeId: string;
  prefs: IngredientPrefs;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to remember this." };

  // A preference is about a recipe you can actually open.
  const access = await canViewRecipe({ userId: session.user.id, recipeId: input.recipeId });
  if (!access.allowed) return { error: "Recipe not found." };

  const prefs = normalizePrefs(input.prefs);
  const isDefault =
    prefs.scalePercent === 100 && prefs.unitSystem === "recipe" && prefs.substitutions.length === 0;

  if (isDefault) {
    await db
      .delete(recipeIngredientPref)
      .where(
        and(
          eq(recipeIngredientPref.userId, session.user.id),
          eq(recipeIngredientPref.recipeId, input.recipeId),
        ),
      );
    return { ok: true as const };
  }

  await db
    .insert(recipeIngredientPref)
    .values({
      userId: session.user.id,
      recipeId: input.recipeId,
      scalePercent: prefs.scalePercent,
      unitSystem: prefs.unitSystem,
      substitutions: prefs.substitutions,
    })
    .onConflictDoUpdate({
      target: [recipeIngredientPref.userId, recipeIngredientPref.recipeId],
      set: {
        scalePercent: prefs.scalePercent,
        unitSystem: prefs.unitSystem,
        substitutions: prefs.substitutions,
        updatedAt: new Date(),
      },
    });

  return { ok: true as const };
}
