"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe, user } from "@/db/schema";
import { getServerSession } from "@/lib/session";

/**
 * Leaving, and taking your data with you.
 *
 * Everything personal is destroyed: the account, email, name, photo, phone,
 * plans, pantry, shopping lists, cook history, saves, follows, and every
 * notification scheduled for you. Nineteen tables cascade from `user`, so the
 * single delete at the end does most of this on its own.
 *
 * **Published recipes are the exception, and deliberately so.** Focolare is a
 * network: other people save recipes, follow channels, and put them in a plan
 * for Thursday. Cascading a channel away would reach into their saved lists and
 * quietly remove something they were relying on, which is a harm to someone who
 * did not ask for anything. So a channel with published work is detached rather
 * than deleted — the person is gone from it entirely, the work stays up under
 * an anonymous name.
 *
 * A channel with nothing published is deleted outright: keeping an empty
 * anonymous shell serves no one and leaves a ghost in the directory.
 *
 * Immediate and irreversible. No grace period, no soft-delete flag, no
 * half-deleted state where signing in might or might not work — when this
 * returns, the account is gone.
 */

/** Shown wherever a detached channel's name used to be. */
const DETACHED_TITLE = "A former member";

export async function deleteAccountAction(input: {
  /** Typed by the person, matched against their own email. */
  confirmEmail: string;
}): Promise<{ ok: true; keptChannels: number } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const [me] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!me) return { error: "Account not found." };

  /**
   * Typing your own address is the confirmation.
   *
   * A button alone is too easy to hit by accident for something with no undo,
   * and a "type DELETE" box is muscle memory people get through without
   * reading. Your own email is specific to you and to this account.
   */
  if (input.confirmEmail.trim().toLowerCase() !== me.email.toLowerCase()) {
    return { error: "That doesn't match the email on this account." };
  }

  let keptChannels = 0;

  await db.transaction(async (tx) => {
    const channels = await tx
      .select({ id: channel.id })
      .from(channel)
      .where(eq(channel.ownerUserId, me.id));

    for (const ch of channels) {
      const [published] = await tx
        .select({ id: recipe.id })
        .from(recipe)
        .where(
          and(
            eq(recipe.channelId, ch.id),
            eq(recipe.visibility, "public"),
            isNotNull(recipe.publishedAt),
          ),
        )
        .limit(1);

      if (!published) {
        // Nothing anyone else could be relying on.
        await tx.delete(channel).where(eq(channel.id, ch.id));
        continue;
      }

      /**
       * Anonymise before detaching.
       *
       * The slug is usually the person's username, so keeping it would leave
       * their name in every URL — which is most of what they asked to remove.
       * Changing it breaks existing links, and that is the right trade: saves
       * and plans reference recipes by id and keep working, while a stranger
       * with the old URL no longer gets a page with their handle on it.
       */
      await tx
        .update(channel)
        .set({
          ownerUserId: null,
          slug: `former-${randomBytes(5).toString("hex")}`,
          title: DETACHED_TITLE,
          bio: null,
          avatarMediaId: null,
          updatedAt: new Date(),
        })
        .where(eq(channel.id, ch.id));

      // Unpublished drafts in a kept channel are still personal, and nobody is
      // relying on them.
      await tx
        .delete(recipe)
        .where(and(eq(recipe.channelId, ch.id), eq(recipe.visibility, "private")));

      keptChannels++;
    }

    // Everything else — sessions, plans, pantry, cook history, saves, follows,
    // scheduled notifications — cascades from here.
    await tx.delete(user).where(eq(user.id, me.id));
  });

  return { ok: true as const, keptChannels };
}
