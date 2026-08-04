"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import {
  cancelShoppingRemindersForUser,
  rescheduleShoppingRemindersForUser,
} from "@/lib/shopping-reminders";

const prefsSchema = z.object({
  phoneE164: z.string().max(32).optional().nullable(),
  notifyCookTimerEmail: z.boolean(),
  notifyCookTimerSms: z.boolean(),
  notifyShoppingReminder: z.boolean().optional(),
});

export async function updateCookNotificationPrefsAction(raw: unknown) {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const parsed = prefsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid input" };

  let phone = parsed.data.phoneE164?.trim() ?? null;
  if (phone === "") phone = null;
  if (phone && !phone.startsWith("+")) {
    return { error: "Use E.164 format with country code, e.g. +14155552671" };
  }

  await db
    .update(user)
    .set({
      phoneE164: phone,
      notifyCookTimerEmail: parsed.data.notifyCookTimerEmail,
      notifyCookTimerSms: parsed.data.notifyCookTimerSms,
      ...(parsed.data.notifyShoppingReminder === undefined
        ? {}
        : { notifyShoppingReminder: parsed.data.notifyShoppingReminder }),
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id));

  // Turning it on has to schedule what's already planned; turning it off has to
  // clear what's pending, or a reminder arrives after it was switched off.
  if (parsed.data.notifyShoppingReminder === true) {
    await rescheduleShoppingRemindersForUser(session.user.id);
  } else if (parsed.data.notifyShoppingReminder === false) {
    await cancelShoppingRemindersForUser(session.user.id);
  }

  return { ok: true as const };
}

export async function dismissHomeIntroAction(): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await db
    .update(user)
    .set({ hideHomeIntro: true, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  return { ok: true as const };
}

/** Bring the home intro back — dismissing it must not be a one-way door. */
export async function restoreHomeIntroAction(): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await db
    .update(user)
    .set({ hideHomeIntro: false, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  revalidatePath("/");
  return { ok: true as const };
}

export async function getHomeIntroHiddenForUser(): Promise<boolean> {
  const session = await getServerSession();
  if (!session?.user?.id) return false;

  const [row] = await db
    .select({ hideHomeIntro: user.hideHomeIntro })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return row?.hideHomeIntro ?? false;
}
