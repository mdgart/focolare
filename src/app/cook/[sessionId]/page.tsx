import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, recipe, recipeStep, scheduledStepEvent } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { buildForwardTimeline, type StepInput } from "@/lib/cook-schedule";
import { CookSessionClient } from "./cook-session-client";

export default async function CookSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in");

  const [cs] = await db
    .select()
    .from(cookSession)
    .where(and(eq(cookSession.id, sessionId), eq(cookSession.userId, session.user.id)))
    .limit(1);
  if (!cs) notFound();

  const [r] = await db.select().from(recipe).where(eq(recipe.id, cs.recipeId)).limit(1);
  if (!r) notFound();

  const steps = await db
    .select()
    .from(recipeStep)
    .where(eq(recipeStep.recipeId, cs.recipeId))
    .orderBy(asc(recipeStep.position));

  const stepInputs: StepInput[] = steps.map((s) => ({
    position: s.position,
    title: s.title,
    durationSeconds: s.durationSeconds,
    offsetFromPrevious: s.offsetFromPrevious,
  }));

  const t0 = new Date(cs.plannedStartAt ?? cs.startedAt ?? new Date(0)).getTime();
  const timeline = buildForwardTimeline(stepInputs, t0);

  const timelineJson = timeline.map((t) => ({
    title: t.title,
    startMs: t.startMs,
    endMs: t.endMs,
    durationSeconds: t.durationSeconds,
  }));

  const stepIdx = Math.min(Math.max(0, cs.currentStepIndex), Math.max(0, steps.length - 1));
  const currentDbStep = steps[stepIdx];

  const [pendingTimer] = await db
    .select({ fireAt: scheduledStepEvent.fireAt })
    .from(scheduledStepEvent)
    .where(
      and(
        eq(scheduledStepEvent.cookSessionId, cs.id),
        eq(scheduledStepEvent.stepIndex, stepIdx),
        eq(scheduledStepEvent.status, "pending"),
      ),
    )
    .limit(1);

  const stepDuration = currentDbStep?.durationSeconds ?? 0;
  const initialTimerArmedAtMs =
    pendingTimer && stepDuration > 0
      ? pendingTimer.fireAt.getTime() - stepDuration * 1000
      : null;

  return (
    <div className="space-y-4">
      <Link href={`/recipe/${r.id}`} className="text-sm font-medium text-amber-900 hover:text-amber-950 hover:underline">
        ← {r.title}
      </Link>
      <CookSessionClient
        cookSessionId={cs.id}
        recipeTitle={r.title}
        timeline={timelineJson}
        initialStepIndex={stepIdx}
        initialTimerArmedAtMs={initialTimerArmedAtMs}
      />
    </div>
  );
}
