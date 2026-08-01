"use server";

import { and, desc, eq, ilike, isNotNull, notExists, or } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe, user } from "@/db/schema";
import { getServerSession } from "@/lib/session";

/**
 * Recipe search for the planner's picker.
 *
 * Separate from listPublishedRecipes because the planner may also offer the
 * cook their own drafts and private recipes — you can plan to cook something
 * you haven't published.
 */
export async function searchRecipesForPlanner(
  query: string,
): Promise<{ id: string; title: string; channelTitle: string | null }[]> {
  const session = await getServerSession();
  if (!session?.user?.id) return [];

  const q = query.trim();
  if (!q) return [];

  const isPublic = and(
    isNotNull(recipe.publishedAt),
    eq(recipe.visibility, "public"),
    eq(recipe.moderationStatus, "approved"),
    notExists(
      db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, channel.ownerUserId), isNotNull(user.blockedAt))),
    ),
  );

  return db
    .select({ id: recipe.id, title: recipe.title, channelTitle: channel.title })
    .from(recipe)
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .where(
      and(
        or(isPublic, eq(channel.ownerUserId, session.user.id)),
        or(ilike(recipe.title, `%${q}%`), ilike(recipe.description, `%${q}%`)),
      ),
    )
    .orderBy(desc(recipe.createdAt))
    .limit(20);
}
