/**
 * Wipe all recipes (steps, tags, comments, ratings, cook sessions cascade),
 * prune media assets nothing references anymore, then reseed the mock catalog.
 *
 * Usage: npm run db:reset:recipes
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import { recipe } from "./schema";
import { seedMockRecipes } from "./seed-mock-recipes";

async function main() {
  const deleted = await db.delete(recipe).returning({ id: recipe.id });
  console.log(`Deleted ${deleted.length} recipes (dependent rows cascaded).`);

  const pruned = await db.execute(sql`
    DELETE FROM media_asset m
    WHERE NOT EXISTS (SELECT 1 FROM channel c WHERE c.avatar_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe r WHERE r.cover_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe_step s WHERE s.image_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe_media rm WHERE rm.media_id = m.id)
  `);
  console.log(`Pruned ${pruned.rowCount ?? 0} orphaned media assets.`);

  await seedMockRecipes();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
