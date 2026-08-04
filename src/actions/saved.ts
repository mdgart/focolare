"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { channel, collection, collectionRecipe, mediaAsset, recipe } from "@/db/schema";
import { getServerSession } from "@/lib/session";

/** Every user gets one implicit list. Named so it can sit alongside real collections later. */
const SAVED_COLLECTION_NAME = "Saved";

async function getOrCreateSavedCollection(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.userId, userId), eq(collection.name, SAVED_COLLECTION_NAME)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(collection)
    .values({ userId, name: SAVED_COLLECTION_NAME })
    .returning({ id: collection.id });
  if (!created) throw new Error("Could not create the Saved list");
  return created.id;
}

export async function isRecipeSaved(recipeId: string): Promise<boolean> {
  const session = await getServerSession();
  if (!session?.user?.id) return false;

  const [row] = await db
    .select({ recipeId: collectionRecipe.recipeId })
    .from(collectionRecipe)
    .innerJoin(collection, eq(collection.id, collectionRecipe.collectionId))
    .where(
      and(
        eq(collection.userId, session.user.id),
        eq(collection.name, SAVED_COLLECTION_NAME),
        eq(collectionRecipe.recipeId, recipeId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Adds or removes the recipe, returning the resulting state so the button can settle. */
export async function toggleSaveRecipeAction(
  recipeId: string,
): Promise<{ saved: boolean } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to save recipes." };

  const [exists] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);
  if (!exists) return { error: "Recipe not found" };

  const collectionId = await getOrCreateSavedCollection(session.user.id);
  const [already] = await db
    .select({ recipeId: collectionRecipe.recipeId })
    .from(collectionRecipe)
    .where(
      and(eq(collectionRecipe.collectionId, collectionId), eq(collectionRecipe.recipeId, recipeId)),
    )
    .limit(1);

  if (already) {
    await db
      .delete(collectionRecipe)
      .where(
        and(eq(collectionRecipe.collectionId, collectionId), eq(collectionRecipe.recipeId, recipeId)),
      );
    revalidatePath("/saved");
    return { saved: false };
  }

  await db.insert(collectionRecipe).values({ collectionId, recipeId }).onConflictDoNothing();
  revalidatePath("/saved");
  return { saved: true };
}

export async function listSavedRecipes() {
  const session = await getServerSession();
  if (!session?.user?.id) return [];

  return db
    .select({
      id: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      addedAt: collectionRecipe.addedAt,
      coverPublicUrl: mediaAsset.publicUrl,
      channelTitle: channel.title,
      channelSlug: channel.slug,
    })
    .from(collectionRecipe)
    .innerJoin(collection, eq(collection.id, collectionRecipe.collectionId))
    .innerJoin(recipe, eq(recipe.id, collectionRecipe.recipeId))
    .innerJoin(channel, eq(channel.id, recipe.channelId))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(
      and(eq(collection.userId, session.user.id), eq(collection.name, SAVED_COLLECTION_NAME)),
    )
    .orderBy(desc(collectionRecipe.addedAt));
}

export async function countSavedRecipes(): Promise<number> {
  const rows = await listSavedRecipes();
  return rows.length;
}
