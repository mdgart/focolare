import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe, user } from "@/db/schema";

/**
 * Who may open a recipe.
 *
 * Three independent gates:
 *   - blocked — the author was blocked by an admin; only they can still reach it
 *   - draft   — unpublished work in progress, owner-only whatever the visibility says
 *   - private — finished but kept to the author's own library
 */
export async function canViewRecipe(opts: {
  userId: string | null;
  recipeId: string;
}): Promise<{ allowed: boolean; reason?: "private" | "draft" | "blocked" }> {
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

  const [owner] = await db
    .select({ ownerUserId: channel.ownerUserId, blockedAt: user.blockedAt })
    .from(channel)
    .innerJoin(user, eq(user.id, channel.ownerUserId))
    .where(eq(channel.id, row.channelId))
    .limit(1);

  const isOwner = opts.userId !== null && owner?.ownerUserId === opts.userId;

  // A blocked author keeps access to their own work; nobody else can reach it by link.
  if (owner?.blockedAt && !isOwner) return { allowed: false, reason: "blocked" };

  const isDraft = row.publishedAt === null;
  if (row.visibility === "public" && !isDraft) return { allowed: true };

  // Everything else needs to be the owner.
  if (isOwner) return { allowed: true };
  return { allowed: false, reason: isDraft ? "draft" : "private" };
}
