"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taxonomyCategory, taxonomySuggestion } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export async function listActiveCategories() {
  return db
    .select()
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.isActive, true))
    .orderBy(asc(taxonomyCategory.sortOrder), asc(taxonomyCategory.label));
}

export async function suggestTaxonomyAction(input: {
  proposedLabel: string;
  parentCategoryId?: string | null;
  synonyms?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to suggest a category" };
  if (!input.proposedLabel.trim()) return { error: "Label required" };
  await db.insert(taxonomySuggestion).values({
    proposerUserId: session.user.id,
    proposedLabel: input.proposedLabel.trim(),
    parentCategoryId: input.parentCategoryId ?? null,
    synonyms: input.synonyms?.trim() || null,
    status: "pending",
  });
  return { ok: true };
}
