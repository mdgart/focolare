"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNotNull, notExists } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  channel,
  groceryItem,
  mealPlan,
  mealSlot,
  mediaAsset,
  planOnHandItem,
  recipe,
  user,
} from "@/db/schema";
import { groceryListAsText } from "@/actions/grocery";
import { rebuildGroceryList } from "@/lib/grocery-sync";
import {
  cancelMealRemindersForPlan,
  cancelMealRemindersForSlots,
  rescheduleMealReminderForSlot,
  rescheduleRemindersForPlan,
} from "@/lib/meal-reminders";
import {
  addDays,
  enumerateDates,
  findOverlap,
  formatPlanDate,
  isMealTime,
  isPlanDate,
  MAX_PLAN_DAYS,
  MEAL_LABEL,
  MEAL_ORDER,
  mealTimeOrDefault,
  planDayCount,
  type MealType,
} from "@/lib/meal-plan";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";
import { isValidTimeZone } from "@/lib/timezone";

export type PlanListRow = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  shareSlug: string | null;
  plannedMeals: number;
};

export type PlanSlotRow = {
  id: string;
  date: string;
  meal: MealType;
  timeAvailableMinutes: number | null;
  mealTime: string | null;
  note: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  recipeCoverUrl: string | null;
};

export type PlanDetail = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  shareSlug: string | null;
  slots: PlanSlotRow[];
  onHand: { id: string; date: string | null; name: string }[];
};

type PlanGuard =
  | { ok: false; error: string }
  | { ok: true; plan: typeof mealPlan.$inferSelect; userId: string };

/**
 * Owner gate used by every mutation here.
 *
 * A plan owned by someone else reports "not found" rather than "forbidden", so
 * the endpoint can't be used to discover which plan ids exist.
 */
async function requirePlan(planId: string): Promise<PlanGuard> {
  const session = await getServerSession();
  if (!session?.user?.id) return { ok: false, error: "Sign in to plan meals." };
  const [plan] = await db.select().from(mealPlan).where(eq(mealPlan.id, planId)).limit(1);
  if (!plan || plan.userId !== session.user.id) return { ok: false, error: "Plan not found." };
  return { ok: true, plan, userId: session.user.id };
}

/**
 * Plans must not overlap.
 *
 * Two plans covering the same day would each generate a shopping list for it and
 * each schedule a reminder for the same dinner, and there would be no answer to
 * "what am I cooking on Thursday". Enforced here rather than only in the form,
 * since a stale page can still submit.
 */
async function findConflictingPlan(
  userId: string,
  range: { startDate: string; endDate: string },
  excludePlanId?: string,
): Promise<{ title: string; startDate: string; endDate: string } | null> {
  const existing = await db
    .select({ id: mealPlan.id, title: mealPlan.title, startDate: mealPlan.startDate, endDate: mealPlan.endDate })
    .from(mealPlan)
    .where(eq(mealPlan.userId, userId));

  return findOverlap(
    range,
    existing.filter((p) => p.id !== excludePlanId),
  );
}

function conflictMessage(clash: { title: string; startDate: string; endDate: string }): string {
  return `Those days overlap “${clash.title}” (${formatPlanDate(clash.startDate)} – ${formatPlanDate(clash.endDate)}). Pick dates outside it.`;
}

export async function createMealPlanAction(input: {
  title?: string;
  startDate: string;
  days: number;
  timezone: string;
}): Promise<{ planId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to plan meals." };

  if (!isPlanDate(input.startDate)) return { error: "Pick a valid start date." };
  const days = Math.floor(input.days);
  if (!Number.isFinite(days) || days < 1) return { error: "A plan needs at least one day." };
  if (days > MAX_PLAN_DAYS) return { error: `Plans can cover at most ${MAX_PLAN_DAYS} days.` };

  const endDate = addDays(input.startDate, days - 1);
  const clash = await findConflictingPlan(session.user.id, { startDate: input.startDate, endDate });
  if (clash) return { error: conflictMessage(clash) };

  const [row] = await db
    .insert(mealPlan)
    .values({
      userId: session.user.id,
      title: input.title?.trim() || "Meal plan",
      startDate: input.startDate,
      endDate,
      timezone: isValidTimeZone(input.timezone) ? input.timezone : "UTC",
    })
    .returning({ id: mealPlan.id });

  revalidatePath("/plan");
  return { planId: row!.id };
}

export async function listMyMealPlans(): Promise<PlanListRow[]> {
  const session = await getServerSession();
  if (!session?.user?.id) return [];

  const plans = await db
    .select()
    .from(mealPlan)
    .where(eq(mealPlan.userId, session.user.id))
    .orderBy(asc(mealPlan.startDate));

  if (plans.length === 0) return [];

  const slots = await db
    .select({ planId: mealSlot.planId, recipeId: mealSlot.recipeId })
    .from(mealSlot)
    .where(inArray(mealSlot.planId, plans.map((p) => p.id)));

  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    startDate: p.startDate,
    endDate: p.endDate,
    shareSlug: p.shareSlug,
    plannedMeals: slots.filter((s) => s.planId === p.id && s.recipeId).length,
  }));
}

export async function getMealPlanForOwner(planId: string): Promise<PlanDetail | null> {
  const guard = await requirePlan(planId);
  if (!guard.ok) return null;

  const slots = await db
    .select({
      id: mealSlot.id,
      date: mealSlot.date,
      meal: mealSlot.meal,
      timeAvailableMinutes: mealSlot.timeAvailableMinutes,
      mealTime: mealSlot.mealTime,
      note: mealSlot.note,
      recipeId: mealSlot.recipeId,
      recipeTitle: recipe.title,
      recipeCoverUrl: mediaAsset.publicUrl,
    })
    .from(mealSlot)
    .leftJoin(recipe, eq(mealSlot.recipeId, recipe.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(eq(mealSlot.planId, planId))
    .orderBy(asc(mealSlot.date));

  const onHand = await db
    .select({ id: planOnHandItem.id, date: planOnHandItem.date, name: planOnHandItem.name })
    .from(planOnHandItem)
    .where(eq(planOnHandItem.planId, planId));

  return {
    id: guard.plan.id,
    title: guard.plan.title,
    startDate: guard.plan.startDate,
    endDate: guard.plan.endDate,
    timezone: guard.plan.timezone,
    shareSlug: guard.plan.shareSlug,
    slots: slots as PlanSlotRow[],
    onHand,
  };
}

/**
 * The whole plan as plain text: the week, then the shopping list.
 *
 * Plain text on purpose. It pastes into a message, a note or an email intact,
 * which is what "send me the plan" nearly always means — and unlike a file it
 * costs the reader nothing to open. Print is handled by the page's own print
 * stylesheet, so the two never drift apart.
 */
export async function planAsText(planId: string): Promise<string> {
  const plan = await getMealPlanForOwner(planId);
  if (!plan) return "";

  const lines = [
    plan.title,
    `${formatPlanDate(plan.startDate)} – ${formatPlanDate(plan.endDate)}`,
  ];

  for (const date of enumerateDates(plan.startDate, plan.endDate)) {
    const slots = plan.slots
      .filter((s) => s.date === date && s.recipeId)
      .sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
    if (slots.length === 0) continue;

    lines.push("", formatPlanDate(date));
    for (const slot of slots) {
      const at = mealTimeOrDefault(slot.meal, slot.mealTime);
      lines.push(`  ${MEAL_LABEL[slot.meal]} ${at} — ${slot.recipeTitle}`);
    }
  }

  const groceries = await groceryListAsText(planId);
  if (groceries) lines.push("", "", groceries);

  return lines.join("\n");
}

export async function updateMealPlanAction(input: {
  planId: string;
  title?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlan(input.planId);
  if (!guard.ok) return { error: guard.error };

  const startDate = input.startDate ?? guard.plan.startDate;
  const endDate = input.endDate ?? guard.plan.endDate;
  if (!isPlanDate(startDate) || !isPlanDate(endDate)) return { error: "Pick valid dates." };

  const days = planDayCount(startDate, endDate);
  if (days < 1) return { error: "The end date is before the start date." };
  if (days > MAX_PLAN_DAYS) return { error: `Plans can cover at most ${MAX_PLAN_DAYS} days.` };

  const clash = await findConflictingPlan(guard.userId, { startDate, endDate }, input.planId);
  if (clash) return { error: conflictMessage(clash) };

  await db
    .update(mealPlan)
    .set({
      title: input.title?.trim() || guard.plan.title,
      startDate,
      endDate,
      updatedAt: new Date(),
    })
    .where(eq(mealPlan.id, input.planId));

  // Shrinking the range orphans slots outside it; drop them and their reminders.
  const all = await db
    .select({ id: mealSlot.id, date: mealSlot.date, recipeId: mealSlot.recipeId })
    .from(mealSlot)
    .where(eq(mealSlot.planId, input.planId));
  const orphaned = all.filter((s) => s.date < startDate || s.date > endDate);
  if (orphaned.length > 0) {
    const ids = orphaned.map((s) => s.id);
    await cancelMealRemindersForSlots(ids);
    await db.delete(mealSlot).where(inArray(mealSlot.id, ids));
    if (orphaned.some((s) => s.recipeId)) {
      await rebuildGroceryList(input.planId, guard.userId);
    }
  }

  revalidatePath(`/plan/${input.planId}`);
  revalidatePath("/plan");
  return { ok: true };
}

export async function deleteMealPlanAction(planId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlan(planId);
  if (!guard.ok) return { error: guard.error };

  await cancelMealRemindersForPlan(planId);
  await db.delete(mealPlan).where(eq(mealPlan.id, planId));

  revalidatePath("/plan");
  return { ok: true };
}

export async function setPlanSharingAction(input: {
  planId: string;
  enabled: boolean;
}): Promise<{ shareSlug: string | null } | { error: string }> {
  const guard = await requirePlan(input.planId);
  if (!guard.ok) return { error: guard.error };

  // Revoking nulls the slug, so an old link 404s immediately.
  const shareSlug = input.enabled ? (guard.plan.shareSlug ?? nanoid(21)) : null;

  await db
    .update(mealPlan)
    .set({ shareSlug, updatedAt: new Date() })
    .where(eq(mealPlan.id, input.planId));

  revalidatePath(`/plan/${input.planId}`);
  return { shareSlug };
}

export type SharedPlanSlot = {
  date: string;
  meal: MealType;
  mealTime: string | null;
  /** Null when the recipe isn't publicly viewable — the title is withheld too. */
  recipeId: string | null;
  recipeTitle: string | null;
  recipeCoverUrl: string | null;
  hasPrivateRecipe: boolean;
};

/**
 * A plan by its share slug, for anyone with the link.
 *
 * Re-applies the public-recipe rules per slot rather than trusting that the
 * planner could see them: a plan may contain the owner's private drafts, and a
 * share link must never leak their titles, covers or ids.
 */
export async function getSharedPlan(slug: string): Promise<{
  title: string;
  startDate: string;
  endDate: string;
  slots: SharedPlanSlot[];
  groceries: { name: string; detail: string | null; checked: boolean }[];
} | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  const [plan] = await db.select().from(mealPlan).where(eq(mealPlan.shareSlug, trimmed)).limit(1);
  if (!plan) return null;

  const slots = await db
    .select({
      date: mealSlot.date,
      meal: mealSlot.meal,
      mealTime: mealSlot.mealTime,
      recipeId: mealSlot.recipeId,
      recipeTitle: recipe.title,
      recipeCoverUrl: mediaAsset.publicUrl,
      // Same predicate as listPublishedRecipes, evaluated per row.
      isPublic: notExists(
        db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, channel.ownerUserId), isNotNull(user.blockedAt))),
      ),
      publishedAt: recipe.publishedAt,
      visibility: recipe.visibility,
      moderationStatus: recipe.moderationStatus,
    })
    .from(mealSlot)
    .leftJoin(recipe, eq(mealSlot.recipeId, recipe.id))
    .leftJoin(channel, eq(recipe.channelId, channel.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(eq(mealSlot.planId, plan.id))
    .orderBy(asc(mealSlot.date));

  const groceries = await db
    .select({ name: groceryItem.name, detail: groceryItem.detail, checked: groceryItem.checked })
    .from(groceryItem)
    .where(eq(groceryItem.planId, plan.id))
    .orderBy(asc(groceryItem.name));

  return {
    title: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    slots: slots.map((s) => {
      const viewable =
        Boolean(s.recipeId) &&
        s.publishedAt !== null &&
        s.visibility === "public" &&
        s.moderationStatus === "approved" &&
        s.isPublic === true;
      return {
        date: s.date,
        meal: s.meal as MealType,
        mealTime: s.mealTime,
        recipeId: viewable ? s.recipeId : null,
        recipeTitle: viewable ? s.recipeTitle : null,
        recipeCoverUrl: viewable ? s.recipeCoverUrl : null,
        hasPrivateRecipe: Boolean(s.recipeId) && !viewable,
      };
    }),
    groceries,
  };
}

export async function upsertMealSlotAction(input: {
  planId: string;
  date: string;
  meal: MealType;
  timeAvailableMinutes?: number | null;
  mealTime?: string | null;
  note?: string | null;
  recipeId?: string | null;
}): Promise<{ slotId: string } | { error: string }> {
  const guard = await requirePlan(input.planId);
  if (!guard.ok) return { error: guard.error };

  if (!isPlanDate(input.date)) return { error: "Invalid date." };
  if (input.date < guard.plan.startDate || input.date > guard.plan.endDate) {
    return { error: "That day isn't in this plan." };
  }
  if (input.mealTime && !isMealTime(input.mealTime)) {
    return { error: "Meal time should look like 19:00." };
  }

  // A recipe can only be planned if this user may actually open it.
  if (input.recipeId) {
    const access = await canViewRecipe({ userId: guard.userId, recipeId: input.recipeId });
    if (!access.allowed) return { error: "You can't add that recipe." };
  }

  // Read before writing so the shopping list is only rebuilt when the recipe
  // actually changed — editing a meal time shouldn't churn the list.
  const [before] = await db
    .select({ recipeId: mealSlot.recipeId })
    .from(mealSlot)
    .where(
      and(
        eq(mealSlot.planId, input.planId),
        eq(mealSlot.date, input.date),
        eq(mealSlot.meal, input.meal),
      ),
    )
    .limit(1);

  const values = {
    planId: input.planId,
    date: input.date,
    meal: input.meal,
    timeAvailableMinutes: input.timeAvailableMinutes ?? null,
    mealTime: input.mealTime ?? null,
    note: input.note?.trim() || null,
    recipeId: input.recipeId ?? null,
  };

  const [row] = await db
    .insert(mealSlot)
    .values(values)
    .onConflictDoUpdate({
      target: [mealSlot.planId, mealSlot.date, mealSlot.meal],
      set: {
        timeAvailableMinutes: values.timeAvailableMinutes,
        mealTime: values.mealTime,
        note: values.note,
        recipeId: values.recipeId,
      },
    })
    .returning({ id: mealSlot.id });

  await rescheduleMealReminderForSlot({
    slot: { ...values, id: row!.id, meal: input.meal },
    plan: { userId: guard.userId, timezone: guard.plan.timezone },
  });

  if ((before?.recipeId ?? null) !== values.recipeId) {
    await rebuildGroceryList(input.planId, guard.userId);
  }

  revalidatePath(`/plan/${input.planId}`);
  return { slotId: row!.id };
}

export async function removeMealSlotAction(input: {
  planId: string;
  date: string;
  meal: MealType;
}): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlan(input.planId);
  if (!guard.ok) return { error: guard.error };

  const removed = await db
    .delete(mealSlot)
    .where(
      and(
        eq(mealSlot.planId, input.planId),
        eq(mealSlot.date, input.date),
        eq(mealSlot.meal, input.meal),
      ),
    )
    .returning({ id: mealSlot.id, recipeId: mealSlot.recipeId });

  await cancelMealRemindersForSlots(removed.map((r) => r.id));

  if (removed.some((r) => r.recipeId)) {
    await rebuildGroceryList(input.planId, guard.userId);
  }

  revalidatePath(`/plan/${input.planId}`);
  return { ok: true };
}

/** Replace-set semantics for one day's on-hand list (or the plan-wide list when date is null). */
export async function setOnHandItemsAction(input: {
  planId: string;
  date: string | null;
  names: string[];
}): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlan(input.planId);
  if (!guard.ok) return { error: guard.error };

  await db
    .delete(planOnHandItem)
    .where(
      input.date === null
        ? and(eq(planOnHandItem.planId, input.planId), eq(planOnHandItem.date, null as never))
        : and(eq(planOnHandItem.planId, input.planId), eq(planOnHandItem.date, input.date)),
    );

  const rows = input.names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((name) => ({
      planId: input.planId,
      date: input.date,
      name,
      normalizedName: normalizeIngredientName(name),
    }))
    .filter((r) => r.normalizedName.length > 0);

  if (rows.length > 0) await db.insert(planOnHandItem).values(rows);

  revalidatePath(`/plan/${input.planId}`);
  return { ok: true };
}

/** Used after a timezone change; exported for completeness. */
export async function resyncPlanRemindersAction(planId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requirePlan(planId);
  if (!guard.ok) return { error: guard.error };
  await rescheduleRemindersForPlan(planId, {
    userId: guard.userId,
    timezone: guard.plan.timezone,
  });
  return { ok: true };
}
