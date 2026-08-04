/**
 * Set an account's profile username — the /c/<username> part of their URL.
 *
 * The account page does the same thing; this covers renaming a profile that
 * predates usernames, or fixing one from the command line.
 *
 * Usage:
 *   npm run db:set-username -- someone@example.com their-name
 *   npm run db:set-username -- someone@example.com their-name --prod
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { channel, user } from "./schema";
import { scriptDb } from "./script-db";
import { validateUsername } from "@/lib/username";

async function main() {
  const [email, requested] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!email || !requested) {
    console.error("Usage: npm run db:set-username -- <email> <username> [--prod]");
    process.exitCode = 1;
    return;
  }

  const parsed = validateUsername(requested);
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }
  const { username } = parsed;

  const { db, pool, prod } = scriptDb(process.argv);
  try {
    const [target] = await db
      .select({ id: channel.id, slug: channel.slug, email: user.email })
      .from(channel)
      .innerJoin(user, eq(channel.ownerUserId, user.id))
      .where(eq(user.email, email.trim().toLowerCase()))
      .limit(1);

    if (!target) {
      console.error(`No profile found for ${email}.`);
      process.exitCode = 1;
      return;
    }
    if (target.slug === username) {
      console.log(`${email} already has /c/${username}.`);
      return;
    }

    const [clash] = await db
      .select({ id: channel.id })
      .from(channel)
      .where(eq(channel.slug, username))
      .limit(1);
    if (clash) {
      console.error(`/c/${username} is taken. Pick a different username.`);
      process.exitCode = 1;
      return;
    }

    await db
      .update(channel)
      .set({ slug: username, updatedAt: new Date() })
      .where(eq(channel.id, target.id));

    console.log(`${prod ? "[production] " : ""}/c/${target.slug}  →  /c/${username}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
