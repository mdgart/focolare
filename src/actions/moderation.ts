"use server";

import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { channel, mediaAsset, recipe } from "@/db/schema";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { getServerSession } from "@/lib/session";

/** Recipes the safety check held back, newest first. Admin only. */
export async function listRecipesForReview() {
  const session = await getServerSession();
  if (!session?.user || !(await isAdminSessionUser(session.user))) return [];

  return db
    .select({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      moderationStatus: recipe.moderationStatus,
      moderationFlags: recipe.moderationFlags,
      moderatedAt: recipe.moderatedAt,
      coverPublicUrl: mediaAsset.publicUrl,
      channelTitle: channel.title,
      channelSlug: channel.slug,
    })
    .from(recipe)
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(ne(recipe.moderationStatus, "approved"))
    .orderBy(desc(recipe.moderatedAt));
}

export async function countRecipesForReview(): Promise<number> {
  const session = await getServerSession();
  if (!session?.user || !(await isAdminSessionUser(session.user))) return 0;
  const rows = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(ne(recipe.moderationStatus, "approved"));
  return rows.length;
}

async function setStatus(
  recipeId: string,
  status: "approved" | "rejected",
): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user) return { error: "Unauthorized" };
  if (!(await isAdminSessionUser(session.user))) return { error: "Admins only" };

  await db
    .update(recipe)
    .set({
      moderationStatus: status,
      moderationFlags: [],
      moderatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(recipe.id, recipeId));
  return { ok: true };
}

/** Clear a flag — the recipe returns to public listings. */
export async function approveFlaggedRecipeAction(recipeId: string) {
  return setStatus(recipeId, "approved");
}

/** Uphold a flag — the recipe stays hidden from listings (the author keeps their copy). */
export async function rejectFlaggedRecipeAction(recipeId: string) {
  return setStatus(recipeId, "rejected");
}
