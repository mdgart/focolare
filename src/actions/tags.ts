"use server";

import { and, asc, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { recipe, recipeTag, tag } from "@/db/schema";

export type TagWithCount = { slug: string; label: string; count: number };

/** Tags used on at least one public published recipe, with counts (for tag cloud). */
export async function listPublicTagCounts(opts?: { search?: string }): Promise<TagWithCount[]> {
  const search = opts?.search?.trim();
  const rows = await db
    .select({
      slug: tag.slug,
      label: tag.label,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(tag)
    .innerJoin(recipeTag, eq(recipeTag.tagId, tag.id))
    .innerJoin(recipe, eq(recipe.id, recipeTag.recipeId))
    .where(
      and(
        eq(recipe.visibility, "public"),
        isNotNull(recipe.publishedAt),
        search && search.length > 0 ? ilike(tag.label, `%${search}%`) : undefined,
      ),
    )
    .groupBy(tag.id, tag.slug, tag.label)
    .orderBy(desc(sql`count(*)`), asc(tag.label));

  return rows.map((r) => ({ slug: r.slug, label: r.label, count: r.count }));
}
