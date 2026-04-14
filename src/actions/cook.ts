"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, recipe, recipeStep, scheduledStepEvent } from "@/db/schema";
import { buildForwardTimeline, plannedStartFromReadyBy, type StepInput } from "@/lib/cook-schedule";
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

  const timeline = buildForwardTimeline(stepInputs, t0Ms);

  const result = await db.transaction(async (tx) => {
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

    for (let i = 0; i < timeline.length; i++) {
      const inst = timeline[i]!;
      const dbStep = steps[i];
      if (!dbStep || inst.durationSeconds <= 0) continue;
      const idempotencyKey = `${cs.id}:timer:${dbStep.id}`;
      const fireAt = new Date(inst.endMs);
      const payload: PushPayloadV1 = {
        v: 1,
        type: "cook_timer",
        cookSessionId: cs.id,
        recipeId: r.id,
        recipeTitle: r.title,
        stepIndex: i,
        stepTitle: inst.title,
        fireAt: fireAt.toISOString(),
        idempotencyKey,
      };
      await tx.insert(scheduledStepEvent).values({
        cookSessionId: cs.id,
        recipeStepId: dbStep.id,
        stepIndex: i,
        kind: "timer_end",
        fireAt,
        status: "pending",
        idempotencyKey,
        pushPayload: payload,
      });
    }

    return { cookSessionId: cs.id } as const;
  });

  return result;
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
  return { ok: true as const };
}
