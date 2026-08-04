import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groceryItem, mealPlan, mealSlot, scheduledStepEvent, user } from "@/db/schema";
import { addDays, formatPlanDate } from "@/lib/meal-plan";
import type { ShoppingReminderPayloadV1 } from "@/lib/notifications-types";
import { zonedWallTimeToUtc } from "@/lib/timezone";

/**
 * "Tomorrow you'll need…" — the evening before a planned day.
 *
 * Scheduled the same way meal reminders are, so a plan that changes takes its
 * reminders with it. The list is worked out when the reminder is scheduled
 * rather than when it fires, which is why every path that rebuilds the shopping
 * list reschedules these too: the two go stale together or not at all.
 *
 * Off unless the cook asked for it. A notification about shopping that nobody
 * requested is spam, and this one arrives at dinner time.
 */

/** Wall-clock hour, in the plan's own timezone, the evening before. */
const REMIND_AT = "18:00";

/** Enough to be useful in a notification; the rest are on the plan. */
const NAMES_IN_BODY = 4;

export function shoppingReminderKey(planId: string, date: string): string {
  return `${planId}:shopping:${date}`;
}

export async function cancelShoppingRemindersForPlan(planId: string): Promise<void> {
  await db
    .delete(scheduledStepEvent)
    .where(
      and(
        eq(scheduledStepEvent.planId, planId),
        eq(scheduledStepEvent.kind, "shopping_reminder"),
      ),
    );
}

/**
 * Rebuild every shopping reminder for a plan.
 *
 * Days with nothing planned, days whose shopping is already done, and evenings
 * that have already passed are all skipped — a reminder for a day you can no
 * longer act on is worse than none.
 */
export async function rescheduleShoppingRemindersForPlan(
  planId: string,
  now: Date = new Date(),
): Promise<void> {
  await cancelShoppingRemindersForPlan(planId);

  const [plan] = await db
    .select({
      id: mealPlan.id,
      title: mealPlan.title,
      userId: mealPlan.userId,
      timezone: mealPlan.timezone,
    })
    .from(mealPlan)
    .where(eq(mealPlan.id, planId))
    .limit(1);
  if (!plan) return;

  const [owner] = await db
    .select({ wants: user.notifyShoppingReminder })
    .from(user)
    .where(eq(user.id, plan.userId))
    .limit(1);
  if (!owner?.wants) return;

  const [slots, items] = await Promise.all([
    db
      .select({ date: mealSlot.date, recipeId: mealSlot.recipeId })
      .from(mealSlot)
      .where(eq(mealSlot.planId, planId)),
    db
      .select({
        name: groceryItem.name,
        checked: groceryItem.checked,
        coveredByPantry: groceryItem.coveredByPantry,
        sources: groceryItem.sources,
      })
      .from(groceryItem)
      .where(eq(groceryItem.planId, planId)),
  ]);

  // Which days each recipe is cooked on, so an item's sources become dates.
  const datesByRecipe = new Map<string, string[]>();
  for (const slot of slots) {
    if (!slot.recipeId) continue;
    datesByRecipe.set(slot.recipeId, [...(datesByRecipe.get(slot.recipeId) ?? []), slot.date]);
  }

  const daysWithFood = [...new Set(slots.filter((s) => s.recipeId).map((s) => s.date))].sort();

  const rows: (typeof scheduledStepEvent.$inferInsert)[] = [];

  for (const date of daysWithFood) {
    const needed = items.filter((item) => {
      // Already bought or already in the cupboard isn't shopping.
      if (item.checked || item.coveredByPantry) return false;
      return (item.sources ?? []).some((source) =>
        (datesByRecipe.get(source.recipeId) ?? []).includes(date),
      );
    });
    if (needed.length === 0) continue;

    const fireAt = zonedWallTimeToUtc(addDays(date, -1), REMIND_AT, plan.timezone);
    // An evening that's already gone can't be acted on.
    if (fireAt.getTime() <= now.getTime()) continue;

    const names = needed.map((n) => n.name);
    const shown = names.slice(0, NAMES_IN_BODY).join(", ");
    const rest = names.length - Math.min(names.length, NAMES_IN_BODY);

    const payload: ShoppingReminderPayloadV1 = {
      v: 1,
      type: "shopping_reminder",
      planId,
      date,
      title: `Shopping for ${formatPlanDate(date)}`,
      body:
        rest > 0
          ? `${shown}, and ${rest} more for tomorrow's meals.`
          : `${shown} — that's everything for tomorrow's meals.`,
      url: `/plan/${planId}`,
      fireAt: fireAt.toISOString(),
      idempotencyKey: shoppingReminderKey(planId, date),
    };

    rows.push({
      planId,
      userId: plan.userId,
      kind: "shopping_reminder",
      fireAt,
      status: "pending",
      idempotencyKey: payload.idempotencyKey,
      pushPayload: payload,
    });
  }

  if (rows.length > 0) await db.insert(scheduledStepEvent).values(rows).onConflictDoNothing();
}

/** Used when the preference is toggled: every plan the user owns, refreshed. */
export async function rescheduleShoppingRemindersForUser(userId: string): Promise<void> {
  const plans = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(eq(mealPlan.userId, userId));
  for (const plan of plans) await rescheduleShoppingRemindersForPlan(plan.id);
}

/** Dropped wholesale when a user turns the reminder off. */
export async function cancelShoppingRemindersForUser(userId: string): Promise<void> {
  const plans = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(eq(mealPlan.userId, userId));
  if (plans.length === 0) return;
  await db
    .delete(scheduledStepEvent)
    .where(
      and(
        inArray(scheduledStepEvent.planId, plans.map((p) => p.id)),
        eq(scheduledStepEvent.kind, "shopping_reminder"),
      ),
    );
}
