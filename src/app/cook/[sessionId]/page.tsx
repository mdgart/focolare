import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, mediaAsset, recipe, recipeStep, scheduledStepEvent } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { buildForwardTimeline, type StepInput } from "@/lib/cook-schedule";
import { armedFromPending } from "@/lib/cook-timers";
import { scaleIngredients } from "@/lib/scale-amount";
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

  const stepMediaIds = [...new Set(steps.map((s) => s.imageMediaId).filter((x): x is string => Boolean(x)))];
  const stepImageUrls: Record<string, string> = {};
  if (stepMediaIds.length > 0) {
    const rows = await db
      .select({ id: mediaAsset.id, publicUrl: mediaAsset.publicUrl })
      .from(mediaAsset)
      .where(inArray(mediaAsset.id, stepMediaIds));
    for (const row of rows) stepImageUrls[row.id] = row.publicUrl;
  }

  const t0 = new Date(cs.plannedStartAt ?? cs.startedAt ?? new Date(0)).getTime();
  const timeline = buildForwardTimeline(stepInputs, t0);

  // buildForwardTimeline only computes timing, so the text a cook actually follows
  // has to be zipped back in from the step rows — without this, cook mode shows a
  // title and a timer but never says what to do.
  const timelineJson = timeline.map((t, i) => ({
    title: t.title,
    startMs: t.startMs,
    endMs: t.endMs,
    durationSeconds: t.durationSeconds,
    instruction: steps[i]?.instruction ?? "",
    imageUrl: stepImageUrls[steps[i]?.imageMediaId ?? ""] ?? null,
  }));

  const stepIdx = Math.min(Math.max(0, cs.currentStepIndex), Math.max(0, steps.length - 1));

  // Every pending timer, not just one on the step being viewed. Steps are
  // navigable, so a cook can be reading step 2 while step 3 simmers — and
  // timers are keyed per step server-side, so more than one can be live.
  const pendingTimers = await db
    .select({
      fireAt: scheduledStepEvent.fireAt,
      stepIndex: scheduledStepEvent.stepIndex,
      pausedRemainingSeconds: scheduledStepEvent.pausedRemainingSeconds,
    })
    .from(scheduledStepEvent)
    .where(
      and(
        eq(scheduledStepEvent.cookSessionId, cs.id),
        eq(scheduledStepEvent.kind, "timer_end"),
        eq(scheduledStepEvent.status, "pending"),
      ),
    );

  // Reconstruction lives in lib/cook-timers so it's the same rules the screen
  // uses, and so it can be checked without a browser.
  const initialArmed = armedFromPending(
    pendingTimers.map((t) => ({
      stepIndex: t.stepIndex,
      fireAtMs: t.fireAt.getTime(),
      pausedRemainingSeconds: t.pausedRemainingSeconds,
    })),
    steps.map((s) => s.durationSeconds),
  );

  return (
    <div className="space-y-4">
      {/* A proper target rather than a line of underlined text: this gets
          pressed mid-cook, often one-handed and rarely with dry hands. */}
      <Link
        href={`/recipe/${r.id}`}
        aria-label={`Back to ${r.title}`}
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-stone-300 bg-white py-2 pl-3 pr-4 text-sm font-medium text-stone-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-900"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4 shrink-0 text-stone-400"
          aria-hidden="true"
        >
          <path d="M12 4.5L6.5 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate">{r.title}</span>
      </Link>
      <CookSessionClient
        cookSessionId={cs.id}
        recipeTitle={r.title}
        timeline={timelineJson}
        initialStepIndex={stepIdx}
        initialArmed={initialArmed}
        // Scaled here rather than in the client so the numbers a cook reads
        // mid-step are the same ones the session was started at.
        ingredients={scaleIngredients(r.ingredients ?? [], (cs.scale || 100) / 100)}
        scalePercent={cs.scale || 100}
      />
    </div>
  );
}
