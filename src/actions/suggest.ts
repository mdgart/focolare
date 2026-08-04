"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNotNull, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  channel,
  collection,
  collectionRecipe,
  cookSession,
  follow,
  mealPlan,
  mealSlot,
  mediaAsset,
  pantryStaple,
  planOnHandItem,
  rating,
  recipe,
  recipeStep,
  user,
} from "@/db/schema";
import { buildCoveredSet } from "@/lib/grocery";
import { rebuildGroceryList } from "@/lib/grocery-sync";
import { rescheduleShoppingRemindersForPlan } from "@/lib/shopping-reminders";
import { effectiveStepSeconds } from "@/lib/infer-duration";
import { rescheduleMealReminderForSlot } from "@/lib/meal-reminders";
import { MEAL_ORDER, type MealType } from "@/lib/meal-plan";
import { getServerSession } from "@/lib/session";
import { suitsMealSlot } from "@/lib/meal-tags";
import {
  fitsInTime,
  rankCandidates,
  type ScoredSuggestion,
  type SuggestionCandidate,
} from "@/lib/suggest";

const CANDIDATE_CAP = 60;

/**
 * Recipes a viewer is allowed to plan: everything public and cleared, plus
 * anything they own themselves (drafts and private recipes included).
 * Mirrors listPublishedRecipes so suggestions can never surface content that
 * Discover would hide.
 */
function viewablePredicate(userId: string) {
  const isPublic = and(
    isNotNull(recipe.publishedAt),
    eq(recipe.visibility, "public"),
    eq(recipe.moderationStatus, "approved"),
    notExists(
      db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, channel.ownerUserId), isNotNull(user.blockedAt))),
    ),
  );
  return or(isPublic, eq(channel.ownerUserId, userId));
}

/** Ids the user saved, follows, or has cooked — the affinity signals. */
async function gatherAffinity(userId: string) {
  const [saved, followed, cooked] = await Promise.all([
    db
      .select({ recipeId: collectionRecipe.recipeId })
      .from(collectionRecipe)
      .innerJoin(collection, eq(collectionRecipe.collectionId, collection.id))
      .where(eq(collection.userId, userId))
      .limit(200),
    db
      .select({ channelId: follow.channelId })
      .from(follow)
      .where(eq(follow.followerUserId, userId))
      .limit(200),
    db
      .select({
        recipeId: cookSession.recipeId,
        // No completedAt column exists; updatedAt is when it was marked done.
        lastAt: sql<Date>`max(${cookSession.updatedAt})`,
        times: sql<number>`cast(count(*) as int)`,
      })
      .from(cookSession)
      .where(and(eq(cookSession.userId, userId), eq(cookSession.state, "completed")))
      .groupBy(cookSession.recipeId)
      .limit(200),
  ]);

  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    savedIds: new Set(saved.map((s) => s.recipeId)),
    followedChannelIds: new Set(followed.map((f) => f.channelId)),
    cookedById: new Map(
      cooked.map((c) => [
        c.recipeId,
        { times: c.times, recent: new Date(c.lastAt).getTime() >= weekAgo },
      ]),
    ),
  };
}

/**
 * Build the candidate pool.
 *
 * Deliberately one query with an OR of the affinity sets plus a popularity
 * fallback, rather than four queries unioned in JS: it keeps the safety
 * predicate in exactly one place and lets Postgres do the ordering.
 */
async function gatherCandidates(userId: string): Promise<SuggestionCandidate[]> {
  const affinity = await gatherAffinity(userId);

  const rows = await db
    .select({
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      channelId: recipe.channelId,
      channelTitle: channel.title,
      ownerUserId: channel.ownerUserId,
      coverUrl: mediaAsset.publicUrl,
      mealTimes: recipe.mealTimes,
      popularity: sql<number>`cast((select count(*) from ${rating} where ${rating.recipeId} = ${recipe.id}) as int)`,
    })
    .from(recipe)
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(viewablePredicate(userId))
    .orderBy(desc(recipe.createdAt))
    .limit(CANDIDATE_CAP);

  if (rows.length === 0) return [];

  // One query for every candidate's steps, then fold durations in memory.
  const steps = await db
    .select({
      recipeId: recipeStep.recipeId,
      durationSeconds: recipeStep.durationSeconds,
      title: recipeStep.title,
      instruction: recipeStep.instruction,
      offsetFromPrevious: recipeStep.offsetFromPrevious,
    })
    .from(recipeStep)
    .where(inArray(recipeStep.recipeId, rows.map((r) => r.id)))
    .orderBy(asc(recipeStep.position));

  const timeById = new Map<string, { seconds: number; estimated: boolean }>();
  for (const s of steps) {
    const prev = timeById.get(s.recipeId) ?? { seconds: 0, estimated: false };
    const eff = effectiveStepSeconds(s);
    timeById.set(s.recipeId, {
      seconds: prev.seconds + eff.seconds + (s.offsetFromPrevious ?? 0),
      estimated: prev.estimated || (eff.estimated && eff.seconds > 0),
    });
  }

  return rows.map((r) => {
    const cooked = affinity.cookedById.get(r.id);
    const time = timeById.get(r.id) ?? { seconds: 0, estimated: false };
    return {
      recipeId: r.id,
      title: r.title,
      coverUrl: r.coverUrl,
      channelTitle: r.channelTitle,
      totalSeconds: time.seconds,
      estimated: time.estimated,
      ingredientNames: (r.ingredients ?? []).map((i) => i.name),
      isSaved: affinity.savedIds.has(r.id),
      isFollowedChannel: affinity.followedChannelIds.has(r.channelId),
      isOwn: r.ownerUserId === userId,
      timesCooked: cooked?.times ?? 0,
      cookedWithinAWeek: cooked?.recent ?? false,
      popularity: r.popularity ?? 0,
      mealTags: r.mealTimes ?? [],
    };
  });
}

async function planContext(planId: string, userId: string) {
  const [plan] = await db.select().from(mealPlan).where(eq(mealPlan.id, planId)).limit(1);
  if (!plan || plan.userId !== userId) return null;

  const [slots, staples, onHand] = await Promise.all([
    db
      .select({
        id: mealSlot.id,
        date: mealSlot.date,
        meal: mealSlot.meal,
        recipeId: mealSlot.recipeId,
        timeAvailableMinutes: mealSlot.timeAvailableMinutes,
        mealTime: mealSlot.mealTime,
      })
      .from(mealSlot)
      .where(eq(mealSlot.planId, planId)),
    db.select({ name: pantryStaple.name }).from(pantryStaple).where(eq(pantryStaple.userId, userId)),
    db
      .select({ name: planOnHandItem.name })
      .from(planOnHandItem)
      .where(eq(planOnHandItem.planId, planId)),
  ]);

  return {
    plan,
    slots,
    covered: buildCoveredSet([...staples, ...onHand].map((r) => r.name)),
  };
}

export async function suggestRecipesForSlotAction(input: {
  planId: string;
  slotId: string;
  limit?: number;
  /** Set when the cook has asked to see the ones that don't fit the slot. */
  ignoreFilters?: boolean;
}): Promise<
  | {
      suggestions: ScoredSuggestion[];
      /** Held back for taking longer than the slot allows. */
      overTime: number;
      /** Held back for being tagged as a different sitting. */
      wrongMeal: number;
      timeAvailableMinutes: number | null;
    }
  | { error: string }
> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to plan meals." };

  const ctx = await planContext(input.planId, session.user.id);
  if (!ctx) return { error: "Plan not found." };

  const slot = ctx.slots.find((s) => s.id === input.slotId);
  if (!slot) return { error: "That meal isn't in this plan." };

  const candidates = await gatherCandidates(session.user.id);
  const limit = slot.timeAvailableMinutes;

  const scoringContext = {
    meal: slot.meal as MealType,
    timeAvailableMinutes: input.ignoreFilters ? null : limit,
    covered: ctx.covered,
    // Everything else already planned, so the same dish isn't proposed twice.
    recipeIdsInPlan: new Set(
      ctx.slots.filter((s) => s.id !== slot.id && s.recipeId).map((s) => s.recipeId!),
    ),
  };

  const suggestions = rankCandidates(
    input.ignoreFilters
      ? candidates.map((c) => ({ ...c, mealTags: [] }))
      : candidates,
    scoringContext,
    input.limit ?? 12,
  );

  // Counted so the picker can offer them rather than looking empty — a cook with
  // a 15-minute slot and a shelf of sourdough deserves better than "no
  // suggestions, try saving some recipes". Counted separately so the offer can
  // say which constraint did it.
  const overTime = input.ignoreFilters
    ? 0
    : candidates.filter((c) => !fitsInTime(c.totalSeconds, limit)).length;
  const wrongMeal = input.ignoreFilters
    ? 0
    : candidates.filter(
        (c) => fitsInTime(c.totalSeconds, limit) && !suitsMealSlot(c.mealTags, slot.meal as MealType),
      ).length;

  return { suggestions, overTime, wrongMeal, timeAvailableMinutes: limit };
}

/**
 * Fill every empty slot in one pass.
 *
 * Chronological, and each pick joins the "already planned" set before the next
 * slot is scored — otherwise the same top-ranked recipe wins every slot and the
 * week is one dish seven times.
 */
export async function fillPlanAction(
  planId: string,
): Promise<{ filled: number } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to plan meals." };

  const ctx = await planContext(planId, session.user.id);
  if (!ctx) return { error: "Plan not found." };

  const candidates = await gatherCandidates(session.user.id);
  if (candidates.length === 0) return { error: "No recipes available to suggest yet." };

  const used = new Set(ctx.slots.filter((s) => s.recipeId).map((s) => s.recipeId!));
  const empty = ctx.slots
    .filter((s) => !s.recipeId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        MEAL_ORDER.indexOf(a.meal as MealType) - MEAL_ORDER.indexOf(b.meal as MealType),
    );

  let filled = 0;
  for (const slot of empty) {
    const [best] = rankCandidates(
      candidates,
      {
        meal: slot.meal as MealType,
        timeAvailableMinutes: slot.timeAvailableMinutes,
        covered: ctx.covered,
        recipeIdsInPlan: used,
      },
      1,
    );
    if (!best) continue;

    await db.update(mealSlot).set({ recipeId: best.recipeId }).where(eq(mealSlot.id, slot.id));
    await rescheduleMealReminderForSlot({
      slot: {
        id: slot.id,
        planId,
        date: slot.date,
        meal: slot.meal as MealType,
        mealTime: slot.mealTime,
        recipeId: best.recipeId,
      },
      plan: { userId: session.user.id, timezone: ctx.plan.timezone },
    });

    used.add(best.recipeId);
    filled += 1;
  }

  if (filled > 0) {
    await rebuildGroceryList(planId, session.user.id);
    await rescheduleShoppingRemindersForPlan(planId);
  }

  revalidatePath(`/plan/${planId}`);
  return { filled };
}
