import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { mealSlot, recipe, recipeStep, scheduledStepEvent } from "@/db/schema";
import { effectiveStepSeconds } from "@/lib/infer-duration";
import { MEAL_LABEL, mealTimeOrDefault, type MealType } from "@/lib/meal-plan";
import type { MealReminderPayloadV1 } from "@/lib/notifications-types";
import { formatWallTimeInZone, zonedWallTimeToUtc } from "@/lib/timezone";

/**
 * "Start cooking now" reminders for planned meals.
 *
 * Reuses the cook-timer pipeline: rows land in `scheduled_step_event` and the
 * same per-minute cron delivers them. The difference is that a meal reminder
 * belongs to a slot and names its own recipient, since there is no cook session
 * yet — the whole point is to tell someone to begin one.
 */

/** Time to get to the kitchen and find the pan before the first step matters. */
const PREP_BUFFER_SECONDS = 10 * 60;

/** Below this, "you should have started already" is noise rather than help. */
const MIN_LEAD_SECONDS = 5 * 60;

function reminderKey(slotId: string): string {
  return `meal:${slotId}`;
}

/** How long the recipe takes, counting durations inferred from step wording. */
async function recipeSecondsFor(recipeId: string): Promise<number> {
  const steps = await db
    .select({
      durationSeconds: recipeStep.durationSeconds,
      title: recipeStep.title,
      instruction: recipeStep.instruction,
      offsetFromPrevious: recipeStep.offsetFromPrevious,
    })
    .from(recipeStep)
    .where(eq(recipeStep.recipeId, recipeId))
    .orderBy(asc(recipeStep.position));

  return steps.reduce(
    (total, s) => total + effectiveStepSeconds(s).seconds + (s.offsetFromPrevious ?? 0),
    0,
  );
}

export type SlotForReminder = {
  id: string;
  planId: string;
  date: string;
  meal: MealType;
  mealTime: string | null;
  recipeId: string | null;
};

export type PlanForReminder = { userId: string; timezone: string };

/**
 * Make the stored reminder match the slot as it is now.
 *
 * Always clears first, so this doubles as the cancel path and cannot leave two
 * reminders for one slot. Same delete-then-insert shape as `armStepTimerAction`.
 */
export async function rescheduleMealReminderForSlot(input: {
  slot: SlotForReminder;
  plan: PlanForReminder;
  now?: Date;
}): Promise<{ scheduled: false } | { scheduled: true; fireAt: Date }> {
  const { slot, plan } = input;
  const now = input.now ?? new Date();

  await db.delete(scheduledStepEvent).where(eq(scheduledStepEvent.mealSlotId, slot.id));

  if (!slot.recipeId) return { scheduled: false };

  const [r] = await db
    .select({ id: recipe.id, title: recipe.title })
    .from(recipe)
    .where(eq(recipe.id, slot.recipeId))
    .limit(1);
  if (!r) return { scheduled: false };

  const wallTime = mealTimeOrDefault(slot.meal, slot.mealTime);
  const mealAt = zonedWallTimeToUtc(slot.date, wallTime, plan.timezone);

  // Nothing to remind about once the meal has passed.
  if (mealAt.getTime() - now.getTime() < MIN_LEAD_SECONDS * 1000) return { scheduled: false };

  const cookSeconds = await recipeSecondsFor(slot.recipeId);
  const idealFireAt = new Date(mealAt.getTime() - (cookSeconds + PREP_BUFFER_SECONDS) * 1000);

  // A long recipe added late would schedule in the past; nudging to "now" is more
  // useful than silently dropping it — the cook still wants to know they're behind.
  const fireAt = idealFireAt.getTime() <= now.getTime()
    ? new Date(now.getTime() + 60_000)
    : idealFireAt;

  const payload: MealReminderPayloadV1 = {
    v: 1,
    type: "meal_reminder",
    mealSlotId: slot.id,
    planId: slot.planId,
    recipeId: r.id,
    recipeTitle: r.title,
    title: "Time to start cooking",
    body:
      idealFireAt.getTime() <= now.getTime()
        ? `Start ${r.title} now — ${MEAL_LABEL[slot.meal].toLowerCase()} is at ${formatWallTimeInZone(mealAt, plan.timezone)}.`
        : `Start ${r.title} to have ${MEAL_LABEL[slot.meal].toLowerCase()} ready by ${formatWallTimeInZone(mealAt, plan.timezone)}.`,
    url: `/plan/${slot.planId}`,
    fireAt: fireAt.toISOString(),
    idempotencyKey: reminderKey(slot.id),
  };

  await db
    .insert(scheduledStepEvent)
    .values({
      userId: plan.userId,
      mealSlotId: slot.id,
      cookSessionId: null,
      stepIndex: null,
      kind: "meal_reminder",
      fireAt,
      idempotencyKey: payload.idempotencyKey,
      pushPayload: payload as unknown as Record<string, unknown>,
    })
    // A concurrent reschedule may have re-inserted between our delete and this.
    .onConflictDoUpdate({
      target: scheduledStepEvent.idempotencyKey,
      set: { fireAt, status: "pending", processedAt: null, pushPayload: payload as unknown as Record<string, unknown> },
    });

  return { scheduled: true, fireAt };
}

/** Re-derive reminders for every slot in a plan (after a timezone or range change). */
export async function rescheduleRemindersForPlan(planId: string, plan: PlanForReminder): Promise<void> {
  const slots = await db
    .select({
      id: mealSlot.id,
      planId: mealSlot.planId,
      date: mealSlot.date,
      meal: mealSlot.meal,
      mealTime: mealSlot.mealTime,
      recipeId: mealSlot.recipeId,
    })
    .from(mealSlot)
    .where(eq(mealSlot.planId, planId));

  for (const slot of slots) {
    await rescheduleMealReminderForSlot({ slot, plan });
  }
}

/** Drop pending reminders for specific slots (used when slots are deleted). */
export async function cancelMealRemindersForSlots(slotIds: string[]): Promise<void> {
  if (slotIds.length === 0) return;
  await db.delete(scheduledStepEvent).where(inArray(scheduledStepEvent.mealSlotId, slotIds));
}

/** Drop everything scheduled for a plan, whatever its status. */
export async function cancelMealRemindersForPlan(planId: string): Promise<void> {
  const slots = await db
    .select({ id: mealSlot.id })
    .from(mealSlot)
    .where(eq(mealSlot.planId, planId));
  await cancelMealRemindersForSlots(slots.map((s) => s.id));
}

export { reminderKey, PREP_BUFFER_SECONDS };

/** Exported for the planner UI: when this slot's reminder is due, if any. */
export async function pendingReminderForSlot(slotId: string): Promise<Date | null> {
  const [row] = await db
    .select({ fireAt: scheduledStepEvent.fireAt })
    .from(scheduledStepEvent)
    .where(
      and(eq(scheduledStepEvent.mealSlotId, slotId), eq(scheduledStepEvent.status, "pending")),
    )
    .limit(1);
  return row?.fireAt ?? null;
}
