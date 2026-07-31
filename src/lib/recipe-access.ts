import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe } from "@/db/schema";

/**
 * Who may open a recipe.
 *
 * Two independent gates:
 *   - unpublished (draft) — the author's work in progress, owner-only whatever the visibility says
 *   - private          — finished but kept to the author's own library
 */
export async function canViewRecipe(opts: {
  userId: string | null;
  recipeId: string;
}): Promise<{ allowed: boolean; reason?: "private" | "draft" }> {
  const [row] = await db
    .select({
      id: recipe.id,
      visibility: recipe.visibility,
      publishedAt: recipe.publishedAt,
      channelId: recipe.channelId,
    })
    .from(recipe)
    .where(eq(recipe.id, opts.recipeId))
    .limit(1);
  if (!row) return { allowed: false };

  const isDraft = row.publishedAt === null;
  if (row.visibility === "public" && !isDraft) return { allowed: true };

  // Everything else needs to be the owner.
  if (!opts.userId) return { allowed: false, reason: isDraft ? "draft" : "private" };
  const [ch] = await db
    .select({ ownerUserId: channel.ownerUserId })
    .from(channel)
    .where(eq(channel.id, row.channelId))
    .limit(1);
  if (ch?.ownerUserId === opts.userId) return { allowed: true };
  return { allowed: false, reason: isDraft ? "draft" : "private" };
}
