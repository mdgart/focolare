import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, recipe, recipeStep } from "@/db/schema";
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

  return (
    <div className="space-y-4">
      <Link href={`/recipe/${r.id}`} className="text-sm text-amber-300 hover:underline">
        ← {r.title}
      </Link>
      <CookSessionClient cookSessionId={cs.id} recipeTitle={r.title} timeline={timelineJson} />
    </div>
  );
}
