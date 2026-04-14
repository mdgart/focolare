import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelSubscription, recipe } from "@/db/schema";

export async function canViewRecipe(opts: {
  userId: string | null;
  recipeId: string;
}): Promise<{ allowed: boolean; reason?: "members_only" }> {
  const [row] = await db
    .select({
      id: recipe.id,
      visibility: recipe.visibility,
      channelId: recipe.channelId,
    })
    .from(recipe)
    .where(eq(recipe.id, opts.recipeId))
    .limit(1);
  if (!row) return { allowed: false };
  if (row.visibility === "public") return { allowed: true };
  if (!opts.userId) return { allowed: false, reason: "members_only" };
  const [sub] = await db
    .select({ id: channelSubscription.id })
    .from(channelSubscription)
    .where(
      and(
        eq(channelSubscription.channelId, row.channelId),
        eq(channelSubscription.userId, opts.userId),
        eq(channelSubscription.demoActive, true),
      ),
    )
    .limit(1);
  if (!sub) return { allowed: false, reason: "members_only" };
  return { allowed: true };
}
