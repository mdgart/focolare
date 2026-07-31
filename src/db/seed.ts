/**
 * Production-safe seed: taxonomy categories only.
 *
 * Recipes are NOT seeded here. A live site needs the category list to exist
 * before anyone can publish, but it must not ship with a fake "Demo Kitchen"
 * channel. Use `npm run db:seed:recipes` for the sample catalogue in development.
 *
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { pool } from "./index";
import { ensureCanonicalTaxonomyCategories } from "@/lib/canonical-taxonomy";

async function main() {
  try {
    await ensureCanonicalTaxonomyCategories();
    console.log("Taxonomy seed complete (idempotent).");
    console.log("No recipes were created — run `npm run db:seed:recipes` for demo data in development.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
