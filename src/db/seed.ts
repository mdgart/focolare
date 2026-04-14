import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { seedMockRecipes } from "./seed-mock-recipes";
import { taxonomyCategory } from "./schema";

async function seedTaxonomy() {
  const existing = await db
    .select({ id: taxonomyCategory.id })
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.slug, "baking"))
    .limit(1);
  if (existing.length) {
    console.log("Taxonomy seed already applied (baking category exists).");
    return;
  }

  const [baking] = await db
    .insert(taxonomyCategory)
    .values({ slug: "baking", label: "Baking", sortOrder: 10 })
    .returning();
  const [cooking] = await db
    .insert(taxonomyCategory)
    .values({ slug: "cooking", label: "Cooking", sortOrder: 20 })
    .returning();
  const [curing] = await db
    .insert(taxonomyCategory)
    .values({ slug: "curing", label: "Curing & preservation", sortOrder: 30 })
    .returning();

  if (baking)
    await db.insert(taxonomyCategory).values([
      { slug: "baking-bread", label: "Bread", parentId: baking.id, sortOrder: 11 },
      { slug: "baking-pastry", label: "Pastry", parentId: baking.id, sortOrder: 12 },
    ]);
  if (cooking)
    await db.insert(taxonomyCategory).values([
      { slug: "cooking-soups", label: "Soups", parentId: cooking.id, sortOrder: 21 },
    ]);
  if (curing)
    await db.insert(taxonomyCategory).values([
      { slug: "curing-charcuterie", label: "Charcuterie", parentId: curing.id, sortOrder: 31 },
    ]);

  console.log("Taxonomy seed complete.", { baking, cooking, curing });
}

async function main() {
  try {
    await seedTaxonomy();
    await seedMockRecipes();
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
