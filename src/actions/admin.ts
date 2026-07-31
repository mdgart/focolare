"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taxonomyCategory, taxonomySuggestion } from "@/db/schema";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { slugify } from "@/lib/slug";
import { getServerSession } from "@/lib/session";

export async function approveTaxonomySuggestionAction(suggestionId: string) {
  const session = await getServerSession();
  if (!session?.user?.id || !(await isAdminSessionUser(session.user))) {
    return { error: "Forbidden" };
  }
  const [sug] = await db
    .select()
    .from(taxonomySuggestion)
    .where(eq(taxonomySuggestion.id, suggestionId))
    .limit(1);
  if (!sug) return { error: "Not found" };

  if (sug.placeholderCategoryId) {
    const slug = `${slugify(sug.proposedLabel)}-${suggestionId.slice(0, 8)}`;
    await db
      .update(taxonomyCategory)
      .set({
        slug,
        label: sug.proposedLabel,
        parentId: sug.parentCategoryId,
        isActive: true,
        proposerUserId: null,
      })
      .where(eq(taxonomyCategory.id, sug.placeholderCategoryId));
    await db
      .update(taxonomySuggestion)
      .set({ status: "approved", moderatorNote: `Activated category ${sug.placeholderCategoryId}` })
      .where(eq(taxonomySuggestion.id, suggestionId));
    return { ok: true as const, categoryId: sug.placeholderCategoryId };
  }

  const slug = slugify(sug.proposedLabel);
  const [cat] = await db
    .insert(taxonomyCategory)
    .values({
      slug: `${slug}-${suggestionId.slice(0, 8)}`,
      label: sug.proposedLabel,
      parentId: sug.parentCategoryId,
      isActive: true,
    })
    .returning();
  await db
    .update(taxonomySuggestion)
    .set({ status: "approved", moderatorNote: `Created category ${cat?.id}` })
    .where(eq(taxonomySuggestion.id, suggestionId));
  return { ok: true as const, categoryId: cat?.id };
}
