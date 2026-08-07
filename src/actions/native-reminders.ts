"use server";

import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledStepEvent } from "@/db/schema";
import {
  isMealReminderPayload,
  isShoppingReminderPayload,
  type AnyPushPayload,
} from "@/lib/notifications-types";
import { HORIZON_DAYS, type DesiredNotification } from "@/lib/native/local-schedule";
import { getServerSession } from "@/lib/session";

/**
 * The reminders this cook's phone should be holding.
 *
 * Cook timers ride on the live `armed` state of the cook screen, which already
 * changes at exactly the right moments. Meal and shopping reminders have no
 * such screen — they are rows scheduled days ahead by the planner — so the
 * device has to ask for them.
 *
 * Read-only and derived: every path that changes a plan already reschedules
 * these rows server-side (`meal-plans.ts`, `suggest.ts`, `account.ts`), so the
 * client's whole job is to re-read after a change and let the reconciler work
 * out the difference. Nothing here writes.
 *
 * The rows already carry `title`, `body`, `url` and `fireAt` in their payload,
 * because the same text is what web push, email and SMS send. Using it here
 * means a reminder reads identically however it reaches you.
 */
export async function pendingRemindersAction(): Promise<DesiredNotification[]> {
  const session = await getServerSession();
  if (!session?.user?.id) return [];

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      kind: scheduledStepEvent.kind,
      fireAt: scheduledStepEvent.fireAt,
      payload: scheduledStepEvent.pushPayload,
    })
    .from(scheduledStepEvent)
    .where(
      and(
        eq(scheduledStepEvent.userId, session.user.id),
        inArray(scheduledStepEvent.kind, ["meal_reminder", "shopping_reminder"]),
        eq(scheduledStepEvent.status, "pending"),
        // Past-due rows belong to the dispatcher, not the phone: scheduling one
        // locally would fire it immediately and announce a meal already eaten.
        gt(scheduledStepEvent.fireAt, now),
        lte(scheduledStepEvent.fireAt, horizon),
      ),
    )
    // Soonest first, so if the budget bites it drops the far future.
    .orderBy(asc(scheduledStepEvent.fireAt))
    .limit(100);

  const out: DesiredNotification[] = [];
  for (const row of rows) {
    // Same narrowing the dispatcher uses: the column is jsonb, so the shape is
    // asserted and then checked by the type guards below rather than trusted.
    const payload = row.payload as AnyPushPayload | null;
    if (!payload) continue;
    // A row whose payload isn't a reminder shape is either from an older
    // version or a cook event mis-filed; either way there's no honest text to
    // show, so it stays the server's problem rather than becoming a blank alert.
    const isReminder = isMealReminderPayload(payload) || isShoppingReminderPayload(payload);
    if (!isReminder) continue;

    out.push({
      key: payload.idempotencyKey,
      title: payload.title,
      body: payload.body,
      fireAt: row.fireAt.getTime(),
      kind: row.kind === "shopping_reminder" ? "shopping_reminder" : "meal_reminder",
      url: payload.url,
    });
  }

  return out;
}
