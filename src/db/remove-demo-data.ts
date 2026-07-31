/**
 * Remove the seeded "Demo Kitchen" creator and everything it owns.
 *
 * For cleaning demo data out of a real deployment. Deleting the demo user
 * cascades to its channel, that channel's recipes, and every dependent row
 * (steps, tags, comments, ratings, cook sessions, saved-list entries), plus the
 * media assets it uploaded. Recipes belonging to real people are untouched.
 *
 * Usage:
 *   npm run db:remove:demo              apply
 *   npm run db:remove:demo -- --dry-run report only, change nothing
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import { channel, recipe, user } from "./schema";

const DEMO_EMAIL = "demo-kitchen@focolare.local";
const DEMO_CHANNEL_SLUG = "demo-kitchen";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [demoUser] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);

  const [demoChannel] = await db
    .select({ id: channel.id, title: channel.title, ownerUserId: channel.ownerUserId })
    .from(channel)
    .where(eq(channel.slug, DEMO_CHANNEL_SLUG))
    .limit(1);

  if (!demoUser && !demoChannel) {
    console.log("No demo data found — nothing to remove.");
    return;
  }

  const recipes = demoChannel
    ? await db
        .select({ id: recipe.id, title: recipe.title })
        .from(recipe)
        .where(eq(recipe.channelId, demoChannel.id))
    : [];

  console.log("Found:");
  if (demoUser) console.log(`  user    ${demoUser.email}`);
  if (demoChannel) console.log(`  channel /${DEMO_CHANNEL_SLUG} (${demoChannel.title})`);
  console.log(`  recipes ${recipes.length}`);
  for (const r of recipes) console.log(`            · ${r.title}`);

  if (dryRun) {
    console.log("\n--dry-run: nothing was deleted.");
    return;
  }

  // Deleting the owner cascades through channel -> recipes -> dependents, and
  // takes the media it uploaded with it.
  if (demoUser) {
    await db.delete(user).where(eq(user.id, demoUser.id));
  } else if (demoChannel) {
    // Channel exists without its seeded owner (owner was replaced at some point).
    await db.delete(channel).where(eq(channel.id, demoChannel.id));
  }

  const pruned = await db.execute(sql`
    DELETE FROM media_asset m
    WHERE NOT EXISTS (SELECT 1 FROM channel c WHERE c.avatar_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe r WHERE r.cover_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe_step s WHERE s.image_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM recipe_media rm WHERE rm.media_id = m.id)
  `);

  // recipe_tag rows cascade with the recipes, but the tag rows themselves remain.
  // A tag attached to nothing is invisible in the cloud and just clutter.
  const prunedTags = await db.execute(sql`
    DELETE FROM tag t
    WHERE NOT EXISTS (SELECT 1 FROM recipe_tag rt WHERE rt.tag_id = t.id)
  `);

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`cast(count(*) as int)` })
    .from(recipe);

  console.log(`\nRemoved demo data.`);
  console.log(`  pruned ${pruned.rowCount ?? 0} orphaned media asset(s)`);
  console.log(`  pruned ${prunedTags.rowCount ?? 0} orphaned tag(s)`);
  console.log(`Recipes remaining in this database: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
