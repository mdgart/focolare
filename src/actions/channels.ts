"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe } from "@/db/schema";

export async function getChannelBySlug(slug: string) {
  const [ch] = await db.select().from(channel).where(eq(channel.slug, slug)).limit(1);
  if (!ch) return null;
  const recipes = await db
    .select()
    .from(recipe)
    .where(eq(recipe.channelId, ch.id))
    .orderBy(desc(recipe.createdAt))
    .limit(50);
  return { channel: ch, recipes };
}
