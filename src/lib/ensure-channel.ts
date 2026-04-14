import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channel } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { nanoid } from "nanoid";

export async function getOrCreateChannelForUser(opts: {
  userId: string;
  displayName: string;
}) {
  const existing = await db
    .select()
    .from(channel)
    .where(eq(channel.ownerUserId, opts.userId))
    .limit(1);
  if (existing[0]) return existing[0]!;

  const base = slugify(opts.displayName || "creator");
  const slug = `${base}-${nanoid(6).toLowerCase()}`;
  const [created] = await db
    .insert(channel)
    .values({
      ownerUserId: opts.userId,
      slug,
      title: opts.displayName || "My channel",
      bio: null,
    })
    .returning();
  return created!;
}
