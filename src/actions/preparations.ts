"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { completeCookSessionAction } from "@/actions/cook";
import { db } from "@/db";
import { channel, cookSession, recipe, recipeStep, scheduledStepEvent, taxonomyCategory } from "@/db/schema";
import { isPreparationRecipe } from "@/lib/preparation-recipe";
import { recipePath } from "@/lib/recipe-url";
import { getServerSession } from "@/lib/session";

export type OngoingPreparation = {
  cookSessionId: string;
  recipeId: string;
  recipeTitle: string;
  /** For the readable recipe link. */
  recipePath: string;
  categoryLabel: string | null;
  currentStepTitle: string;
  currentStepIndex: number;
  stepCount: number;
  startedAt: Date | null;
  timerEndsAt: Date | null;
  stepDurationSeconds: number;
};

type TaxonomyRow = { id: string; slug: string; label: string; parentId: string | null };

function taxonomySlugsForCategory(id: string | null, byId: Map<string, TaxonomyRow>): string[] {
  if (!id) return [];
  const slugs: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    slugs.push(cur.slug);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return slugs;
}

async function buildOngoingPreparations(userId: string): Promise<OngoingPreparation[]> {
  const sessions = await db
    .select({
      cookSessionId: cookSession.id,
      recipeId: cookSession.recipeId,
      recipeTitle: recipe.title,
      recipeSlug: recipe.slug,
      channelSlug: channel.slug,
      taxonomyCategoryId: recipe.taxonomyCategoryId,
      currentStepIndex: cookSession.currentStepIndex,
      startedAt: cookSession.startedAt,
    })
    .from(cookSession)
    .innerJoin(recipe, eq(cookSession.recipeId, recipe.id))
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .where(and(eq(cookSession.userId, userId), eq(cookSession.state, "active")))
    .orderBy(desc(cookSession.startedAt));

  if (sessions.length === 0) return [];

  const recipeIds = [...new Set(sessions.map((s) => s.recipeId))];
  const sessionIds = sessions.map((s) => s.cookSessionId);

  const [allSteps, taxonomyRows, pendingTimers] = await Promise.all([
    db
      .select({
        recipeId: recipeStep.recipeId,
        title: recipeStep.title,
        position: recipeStep.position,
        durationSeconds: recipeStep.durationSeconds,
        offsetFromPrevious: recipeStep.offsetFromPrevious,
      })
      .from(recipeStep)
      .where(inArray(recipeStep.recipeId, recipeIds))
      .orderBy(asc(recipeStep.position)),
    db.select().from(taxonomyCategory),
    db
      .select({
        cookSessionId: scheduledStepEvent.cookSessionId,
        stepIndex: scheduledStepEvent.stepIndex,
        fireAt: scheduledStepEvent.fireAt,
      })
      .from(scheduledStepEvent)
      .where(
        and(
          inArray(scheduledStepEvent.cookSessionId, sessionIds),
          eq(scheduledStepEvent.status, "pending"),
        ),
      ),
  ]);

  const stepsByRecipe = new Map<string, typeof allSteps>();
  for (const step of allSteps) {
    const list = stepsByRecipe.get(step.recipeId) ?? [];
    list.push(step);
    stepsByRecipe.set(step.recipeId, list);
  }

  const taxonomyById = new Map(taxonomyRows.map((r) => [r.id, r]));

  const timerBySessionStep = new Map<string, Date>();
  for (const t of pendingTimers) {
    timerBySessionStep.set(`${t.cookSessionId}:${t.stepIndex}`, t.fireAt);
  }

  const results: OngoingPreparation[] = [];

  for (const s of sessions) {
    const steps = stepsByRecipe.get(s.recipeId) ?? [];
    const taxRow = s.taxonomyCategoryId ? taxonomyById.get(s.taxonomyCategoryId) : undefined;
    const taxSlugs = taxonomySlugsForCategory(s.taxonomyCategoryId, taxonomyById);

    if (
      !isPreparationRecipe({
        taxonomySlug: taxRow?.slug ?? null,
        taxonomySlugs: taxSlugs,
        steps,
      })
    ) {
      continue;
    }

    const stepIdx = Math.min(Math.max(0, s.currentStepIndex), Math.max(0, steps.length - 1));
    const currentStep = steps[stepIdx];
    const timerEndsAt = timerBySessionStep.get(`${s.cookSessionId}:${stepIdx}`) ?? null;

    results.push({
      cookSessionId: s.cookSessionId,
      recipeId: s.recipeId,
      recipeTitle: s.recipeTitle,
      recipePath: recipePath(s.channelSlug, s.recipeSlug),
      categoryLabel: taxRow?.label ?? null,
      currentStepTitle: currentStep?.title ?? "In progress",
      currentStepIndex: stepIdx,
      stepCount: steps.length,
      startedAt: s.startedAt,
      timerEndsAt,
      stepDurationSeconds: currentStep?.durationSeconds ?? 0,
    });
  }

  return results;
}

export async function listOngoingPreparationsForUser(): Promise<OngoingPreparation[]> {
  const session = await getServerSession();
  if (!session?.user?.id) return [];
  return buildOngoingPreparations(session.user.id);
}

export async function countOngoingPreparationsForUser(): Promise<number> {
  const items = await listOngoingPreparationsForUser();
  return items.length;
}

export async function completePreparationAction(
  cookSessionId: string,
): Promise<{ ok: true } | { error: string }> {
  return completeCookSessionAction(cookSessionId);
}
