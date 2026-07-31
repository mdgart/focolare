/**
 * Add tags to already-seeded mock recipes in place — no deletes, safe to re-run.
 * Use this instead of db:reset:recipes when the database has real recipes worth keeping.
 *
 * Usage: npm run db:backfill:tags
 */
import "dotenv/config";
import { pool } from "./index";
import { backfillMockRecipeTags } from "./seed-mock-recipes";

backfillMockRecipeTags()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
