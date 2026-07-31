"use server";

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, recipe, recipeStep, scheduledStepEvent } from "@/db/schema";
import { plannedStartFromReadyBy, type StepInput } from "@/lib/cook-schedule";
import type { PushPayloadV1 } from "@/lib/notifications-types";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";

export async function startCookSessionAction(input: {
  recipeId: string;
  targetReadyAtISO?: string | null;
}): Promise<{ cookSessionId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const access = await canViewRecipe({ userId: session.user.id, recipeId: input.recipeId });
  if (!access.allowed) return { error: access.reason ?? "Forbidden" };

  const [r] = await db.select().from(recipe).where(eq(recipe.id, input.recipeId)).limit(1);
  if (!r) return { error: "Recipe not found" };

  const steps = await db
    .select()
    .from(recipeStep)
    .where(eq(recipeStep.recipeId, input.recipeId))
    .orderBy(asc(recipeStep.position));

  const stepInputs: StepInput[] = steps.map((s) => ({
    position: s.position,
    title: s.title,
    durationSeconds: s.durationSeconds,
    offsetFromPrevious: s.offsetFromPrevious,
  }));

  let t0Ms = Date.now();
  let targetReadyAt: Date | null = null;
  if (input.targetReadyAtISO) {
    targetReadyAt = new Date(input.targetReadyAtISO);
    if (Number.isNaN(targetReadyAt.getTime())) return { error: "Invalid target time" };
    const planned = plannedStartFromReadyBy(stepInputs, targetReadyAt.getTime());
    t0Ms = Math.max(Date.now(), planned);
  }

  const result = await db.transaction(async (tx) => {
    /** Only one active cook session per user; supersede older ones (avoids stuck “Resume cooking”). */
    const oldActives = await tx
      .select({ id: cookSession.id })
      .from(cookSession)
      .where(and(eq(cookSession.userId, session.user.id), eq(cookSession.state, "active")));

    for (const { id } of oldActives) {
      await tx
        .update(scheduledStepEvent)
        .set({ status: "skipped", processedAt: new Date() })
        .where(
          and(eq(scheduledStepEvent.cookSessionId, id), eq(scheduledStepEvent.status, "pending")),
        );
      await tx
        .update(cookSession)
        .set({ state: "cancelled", updatedAt: new Date() })
        .where(eq(cookSession.id, id));
    }

    const [cs] = await tx
      .insert(cookSession)
      .values({
        userId: session.user.id,
        recipeId: input.recipeId,
        state: "active",
        targetReadyAt,
        plannedStartAt: new Date(t0Ms),
        currentStepIndex: 0,
        startedAt: new Date(),
      })
      .returning();

    if (!cs) return { error: "Could not create session" as const };

    /** Timer push notifications are created when the user taps “Start timer” on each step (`armStepTimerAction`). */

    return { cookSessionId: cs.id } as const;
  });

  return result;
}

/** Skip any pending timer notification for this step (e.g. user advanced early). */
export async function skipPendingTimersForCookStepAction(input: {
  cookSessionId: string;
  stepIndex: number;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const [cs] = await db
    .select({ id: cookSession.id })
    .from(cookSession)
    .where(and(eq(cookSession.id, input.cookSessionId), eq(cookSession.userId, session.user.id)))
    .limit(1);
  if (!cs) return { error: "Not found" };
  await db
    .update(scheduledStepEvent)
    .set({ status: "skipped", processedAt: new Date() })
    .where(
      and(
        eq(scheduledStepEvent.cookSessionId, input.cookSessionId),
        eq(scheduledStepEvent.stepIndex, input.stepIndex),
        eq(scheduledStepEvent.status, "pending"),
      ),
    );
  return { ok: true as const };
}

/** Schedule the push for this step’s timer to fire `duration` after the user starts it. */
export async function armStepTimerAction(input: {
  cookSessionId: string;
  stepIndex: number;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const [row] = await db
    .select({
      sessionId: cookSession.id,
      recipeId: cookSession.recipeId,
      recipeTitle: recipe.title,
    })
    .from(cookSession)
    .innerJoin(recipe, eq(cookSession.recipeId, recipe.id))
    .where(and(eq(cookSession.id, input.cookSessionId), eq(cookSession.userId, session.user.id)))
    .limit(1);
  if (!row) return { error: "Not found" };

  const steps = await db
    .select()
    .from(recipeStep)
    .where(eq(recipeStep.recipeId, row.recipeId))
    .orderBy(asc(recipeStep.position));
  const dbStep = steps[input.stepIndex];
  if (!dbStep) return { error: "Invalid step" };

  const dur = dbStep.durationSeconds ?? 0;
  if (dur <= 0) return { ok: true as const };

  const stepTitle = dbStep.title.trim() || `Step ${input.stepIndex + 1}`;

  const idempotencyKey = `${row.sessionId}:timer:${dbStep.id}`;
  const fireAt = new Date(Date.now() + dur * 1000);

  await db.delete(scheduledStepEvent).where(eq(scheduledStepEvent.idempotencyKey, idempotencyKey));

  const payload: PushPayloadV1 = {
    v: 1,
    type: "cook_timer",
    cookSessionId: row.sessionId,
    recipeId: row.recipeId,
    recipeTitle: row.recipeTitle,
    stepIndex: input.stepIndex,
    stepTitle,
    fireAt: fireAt.toISOString(),
    idempotencyKey,
  };

  await db.insert(scheduledStepEvent).values({
    cookSessionId: row.sessionId,
    recipeStepId: dbStep.id,
    stepIndex: input.stepIndex,
    kind: "timer_end",
    fireAt,
    status: "pending",
    idempotencyKey,
    pushPayload: payload,
  });

  return { ok: true as const };
}

export async function advanceCookStepAction(input: {
  cookSessionId: string;
  stepIndex: number;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (input.stepIndex < 0) return { error: "Invalid step" };

  const [cs] = await db
    .select({ id: cookSession.id })
    .from(cookSession)
    .where(and(eq(cookSession.id, input.cookSessionId), eq(cookSession.userId, session.user.id)))
    .limit(1);
  if (!cs) return { error: "Not found" };

  await db
    .update(cookSession)
    .set({ currentStepIndex: input.stepIndex, updatedAt: new Date() })
    .where(eq(cookSession.id, input.cookSessionId));

  return { ok: true as const };
}

export async function getActiveCookSessionForUser() {
  const session = await getServerSession();
  if (!session?.user?.id) return null;
  const [row] = await db
    .select()
    .from(cookSession)
    .where(and(eq(cookSession.userId, session.user.id), eq(cookSession.state, "active")))
    .orderBy(desc(cookSession.startedAt))
    .limit(1);
  return row ?? null;
}

export async function completeCookSessionAction(cookSessionId: string) {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  await db
    .update(cookSession)
    .set({ state: "completed", updatedAt: new Date() })
    .where(and(eq(cookSession.id, cookSessionId), eq(cookSession.userId, session.user.id)));
  await db
    .update(scheduledStepEvent)
    .set({ status: "skipped", processedAt: new Date() })
    .where(
      and(
        eq(scheduledStepEvent.cookSessionId, cookSessionId),
        eq(scheduledStepEvent.status, "pending"),
      ),
    );

  /** Defensive: cancel any other leaked `active` rows for this user (legacy duplicates). */
  const stray = await db
    .select({ id: cookSession.id })
    .from(cookSession)
    .where(
      and(
        eq(cookSession.userId, session.user.id),
        eq(cookSession.state, "active"),
        ne(cookSession.id, cookSessionId),
      ),
    );
  for (const { id } of stray) {
    await db
      .update(scheduledStepEvent)
      .set({ status: "skipped", processedAt: new Date() })
      .where(and(eq(scheduledStepEvent.cookSessionId, id), eq(scheduledStepEvent.status, "pending")));
    await db
      .update(cookSession)
      .set({ state: "cancelled", updatedAt: new Date() })
      .where(eq(cookSession.id, id));
  }

  return { ok: true as const };
}
