import "dotenv/config";
import { pool } from "./index";
import { seedMockRecipes } from "./seed-mock-recipes";
import { ensureCanonicalTaxonomyCategories } from "@/lib/canonical-taxonomy";

async function seedTaxonomy() {
  await ensureCanonicalTaxonomyCategories();
  console.log("Taxonomy seed complete (idempotent).");
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
