"use server";

import { and, asc, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { taxonomyCategory, taxonomySuggestion } from "@/db/schema";
import { ensureCanonicalTaxonomyCategories } from "@/lib/canonical-taxonomy";
import { slugify } from "@/lib/slug";
import { getServerSession } from "@/lib/session";

type TaxonomyCategoryRow = typeof taxonomyCategory.$inferSelect;

function formatCategoryOptionLabel(c: TaxonomyCategoryRow, all: TaxonomyCategoryRow[]): string {
  const parent = c.parentId ? all.find((x) => x.id === c.parentId) : null;
  return parent ? `${parent.label} → ${c.label}` : c.label;
}

export async function listActiveCategories() {
  await ensureCanonicalTaxonomyCategories();
  return db
    .select()
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.isActive, true))
    .orderBy(asc(taxonomyCategory.sortOrder), asc(taxonomyCategory.label));
}

/** Active categories plus this user's inactive placeholders (for create-recipe and modal parent list uses active only). */
export async function listCategoriesForRecipeEditor(userId: string): Promise<{ id: string; label: string }[]> {
  await ensureCanonicalTaxonomyCategories();
  const rows = await db
    .select()
    .from(taxonomyCategory)
    .where(
      or(
        eq(taxonomyCategory.isActive, true),
        and(eq(taxonomyCategory.isActive, false), eq(taxonomyCategory.proposerUserId, userId)),
      ),
    )
    .orderBy(asc(taxonomyCategory.sortOrder), asc(taxonomyCategory.label));

  return rows.map((c) => {
    const base = formatCategoryOptionLabel(c, rows);
    const suffix = !c.isActive ? " (pending approval)" : "";
    return { id: c.id, label: `${base}${suffix}` };
  });
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

/** Create inactive taxonomy row + suggestion; used from create-recipe modal so the category can be selected immediately. */
export async function suggestCategoryWithPlaceholderAction(input: {
  proposedLabel: string;
  parentCategoryId?: string | null;
  synonyms?: string | null;
}): Promise<{ ok: true; categoryId: string; label: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to suggest a category" };
  const label = input.proposedLabel.trim();
  if (!label) return { error: "Label required" };

  let parentId: string | null = input.parentCategoryId?.trim() || null;
  if (parentId) {
    const [p] = await db
      .select({ id: taxonomyCategory.id })
      .from(taxonomyCategory)
      .where(and(eq(taxonomyCategory.id, parentId), eq(taxonomyCategory.isActive, true)))
      .limit(1);
    if (!p) return { error: "Invalid parent category" };
  } else {
    parentId = null;
  }

  const synonyms = input.synonyms?.trim() || null;
  const slugBase = slugify(label);

  try {
    const result = await db.transaction(async (tx) => {
      const slug = `${slugBase}-${nanoid(10).toLowerCase()}`;
      const [cat] = await tx
        .insert(taxonomyCategory)
        .values({
          slug,
          label,
          parentId,
          isActive: false,
          proposerUserId: session.user.id,
          sortOrder: 0,
        })
        .returning();

      if (!cat) throw new Error("Insert category failed");

      await tx.insert(taxonomySuggestion).values({
        proposerUserId: session.user.id,
        proposedLabel: label,
        parentCategoryId: parentId,
        synonyms,
        placeholderCategoryId: cat.id,
        status: "pending",
      });

      let display = label;
      if (parentId) {
        const [pr] = await tx
          .select({ label: taxonomyCategory.label })
          .from(taxonomyCategory)
          .where(eq(taxonomyCategory.id, parentId))
          .limit(1);
        if (pr) display = `${pr.label} → ${label}`;
      }
      return { categoryId: cat.id, label: `${display} (pending approval)` };
    });
    return { ok: true, ...result };
  } catch {
    return { error: "Could not save category suggestion. Try a different name." };
  }
}
