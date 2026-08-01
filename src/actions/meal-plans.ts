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
import {
  cancelMealRemindersForPlan,
  cancelMealRemindersForSlots,
  rescheduleMealReminderForSlot,
  rescheduleRemindersForPlan,
} from "@/lib/meal-reminders";
import {
  addDays,
  isMealTime,
  isPlanDate,
  MAX_PLAN_DAYS,
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

  const [row] = await db
    .insert(mealPlan)
    .values({
      userId: session.user.id,
      title: input.title?.trim() || "Meal plan",
      startDate: input.startDate,
      endDate: addDays(input.startDate, days - 1),
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
    .select({ id: mealSlot.id, date: mealSlot.date })
    .from(mealSlot)
    .where(eq(mealSlot.planId, input.planId));
  const orphaned = all.filter((s) => s.date < startDate || s.date > endDate).map((s) => s.id);
  if (orphaned.length > 0) {
    await cancelMealRemindersForSlots(orphaned);
    await db.delete(mealSlot).where(inArray(mealSlot.id, orphaned));
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
    .returning({ id: mealSlot.id });

  await cancelMealRemindersForSlots(removed.map((r) => r.id));

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
