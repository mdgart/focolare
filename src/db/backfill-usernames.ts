/**
 * Turn the old auto-generated profile slugs into readable usernames.
 *
 * Anyone who signed up before usernames existed got display-name-o00hik. This
 * rewrites those to the same name people would get today — the first part of
 * their email, numbered if it's taken. Slugs that don't look auto-generated are
 * left alone: someone may have picked them.
 *
 * Renaming changes a public URL, so this prints the plan and does nothing
 * unless you pass --apply.
 *
 * Usage:
 *   npm run db:backfill:usernames                     # show what would change
 *   npm run db:backfill:usernames -- --apply          # do it
 *   npm run db:backfill:usernames -- --apply --prod   # …to the deployed database
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { channel, user } from "./schema";
import { scriptDb } from "./script-db";
import { slugify } from "@/lib/slug";
import {
  defaultUsernameBase,
  isLegacyGeneratedUsername,
  suffixedUsername,
} from "@/lib/username";

async function main() {
  const apply = process.argv.includes("--apply");
  const { db, pool } = scriptDb(process.argv);

  try {
    const rows = await db
      .select({
        id: channel.id,
        slug: channel.slug,
        title: channel.title,
        email: user.email,
        name: user.name,
      })
      .from(channel)
      .innerJoin(user, eq(channel.ownerUserId, user.id));

    const taken = new Set(rows.map((r) => r.slug));
    const renames: { id: string; from: string; to: string }[] = [];

    for (const row of rows) {
      if (!isLegacyGeneratedUsername(row.slug, slugify(row.title))) continue;

      const base = defaultUsernameBase({ email: row.email, displayName: row.name ?? row.title });
      let target = base;
      for (let n = 1; taken.has(target); n++) target = suffixedUsername(base, n);

      taken.delete(row.slug);
      taken.add(target);
      renames.push({ id: row.id, from: row.slug, to: target });
    }

    if (renames.length === 0) {
      console.log(`No auto-generated slugs left to rename (${rows.length} profiles checked).`);
      return;
    }

    for (const r of renames) console.log(`/c/${r.from}  →  /c/${r.to}`);

    if (!apply) {
      console.log(`\n${renames.length} to rename. Re-run with --apply to write them.`);
      return;
    }

    for (const r of renames) {
      await db
        .update(channel)
        .set({ slug: r.to, updatedAt: new Date() })
        .where(eq(channel.id, r.id));
    }
    console.log(`\nRenamed ${renames.length}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
