import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { channel } from "@/db/schema";
import { defaultUsernameBase, suffixedUsername, usernameCandidates } from "@/lib/username";

/** Postgres unique_violation — someone took the name between our check and our insert. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function getOrCreateChannelForUser(opts: {
  userId: string;
  displayName: string;
  /** Preferred source for the starting username — the part before the @. */
  email?: string | null;
}) {
  const existing = await db
    .select()
    .from(channel)
    .where(eq(channel.ownerUserId, opts.userId))
    .limit(1);
  if (existing[0]) return existing[0]!;

  const base = defaultUsernameBase({ email: opts.email, displayName: opts.displayName });
  const candidates = usernameCandidates(base);
  const taken = new Set(
    (
      await db
        .select({ slug: channel.slug })
        .from(channel)
        .where(inArray(channel.slug, candidates))
    ).map((row) => row.slug),
  );

  // The pre-check keeps the common case to one attempt; the retry is what
  // actually handles two people signing up with the same name at once.
  const free = candidates.filter((c) => !taken.has(c));
  for (let attempt = 0; attempt < free.length; attempt++) {
    try {
      const [created] = await db
        .insert(channel)
        .values({
          ownerUserId: opts.userId,
          slug: free[attempt]!,
          title: opts.displayName || "My channel",
          bio: null,
        })
        .returning();
      return created!;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  // Every readable name was taken in the time this took. Fall back to a number
  // far enough out that nobody is competing for it — an ugly address beats a
  // failed sign-up.
  const [created] = await db
    .insert(channel)
    .values({
      ownerUserId: opts.userId,
      slug: suffixedUsername(base, Date.now() % 100000),
      title: opts.displayName || "My channel",
      bio: null,
    })
    .returning();
  return created!;
}
