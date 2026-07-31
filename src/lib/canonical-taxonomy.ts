import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taxonomyCategory } from "@/db/schema";

async function ensureCategoryRow(opts: {
  slug: string;
  label: string;
  sortOrder: number;
  parentSlug?: string | null;
}): Promise<void> {
  let parentId: string | null = null;
  if (opts.parentSlug) {
    const [p] = await db
      .select({ id: taxonomyCategory.id })
      .from(taxonomyCategory)
      .where(eq(taxonomyCategory.slug, opts.parentSlug))
      .limit(1);
    if (!p) return;
    parentId = p.id;
  }

  await db
    .insert(taxonomyCategory)
    .values({
      slug: opts.slug,
      label: opts.label,
      parentId,
      sortOrder: opts.sortOrder,
    })
    .onConflictDoNothing({ target: taxonomyCategory.slug });
}

/**
 * Default recipe taxonomy (idempotent). Keeps Discover / editor in sync with the homepage
 * even when the DB was seeded before newer roots existed.
 */
export async function ensureCanonicalTaxonomyCategories(): Promise<void> {
  await ensureCategoryRow({ slug: "baking", label: "Baking", sortOrder: 10 });
  await ensureCategoryRow({ slug: "fermenting", label: "Fermenting", sortOrder: 15 });
  await ensureCategoryRow({ slug: "cooking", label: "Cooking", sortOrder: 20 });
  await ensureCategoryRow({ slug: "curing", label: "Curing", sortOrder: 30 });
  await ensureCategoryRow({ slug: "preserving", label: "Preserving", sortOrder: 35 });
  await ensureCategoryRow({ slug: "desserts", label: "Desserts", sortOrder: 40 });

  await ensureCategoryRow({ slug: "baking-bread", label: "Bread", sortOrder: 11, parentSlug: "baking" });
  await ensureCategoryRow({ slug: "baking-pastry", label: "Pastry", sortOrder: 12, parentSlug: "baking" });
  await ensureCategoryRow({ slug: "cooking-soups", label: "Soups", sortOrder: 21, parentSlug: "cooking" });
  await ensureCategoryRow({ slug: "curing-charcuterie", label: "Charcuterie", sortOrder: 31, parentSlug: "curing" });

  /** Re-activate preserving if it was hidden by an earlier deploy. */
  await db.update(taxonomyCategory).set({ isActive: true }).where(eq(taxonomyCategory.slug, "preserving"));

  await db
    .update(taxonomyCategory)
    .set({ label: "Curing" })
    .where(and(eq(taxonomyCategory.slug, "curing"), eq(taxonomyCategory.label, "Curing & preservation")));
}
