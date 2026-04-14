"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelSubscription } from "@/db/schema";
import { getServerSession } from "@/lib/session";

/** Phase-1 demo: toggle member access for a channel (no payment). */
export async function setDemoSubscriptionAction(input: {
  channelId: string;
  active: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  await db
    .insert(channelSubscription)
    .values({
      userId: session.user.id,
      channelId: input.channelId,
      demoActive: input.active,
    })
    .onConflictDoUpdate({
      target: [channelSubscription.userId, channelSubscription.channelId],
      set: {
        demoActive: input.active,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getDemoSubscriptionState(channelId: string) {
  const session = await getServerSession();
  if (!session?.user?.id) return { active: false };
  const [row] = await db
    .select({ demoActive: channelSubscription.demoActive })
    .from(channelSubscription)
    .where(
      and(
        eq(channelSubscription.channelId, channelId),
        eq(channelSubscription.userId, session.user.id),
      ),
    )
    .limit(1);
  return { active: row?.demoActive ?? false };
}
