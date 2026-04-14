/**
 * Run mock recipe seed without taxonomy (use after `npm run db:seed` or when taxonomy already exists).
 */
import "dotenv/config";
import { pool } from "./index";
import { seedMockRecipes } from "./seed-mock-recipes";

async function main() {
  try {
    await seedMockRecipes();
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
