import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getRecipeBundle } from "@/actions/recipes";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";
import { db } from "@/db";
import { channel } from "@/db/schema";
import { StartCookForm } from "./start-cook-form";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const access = await canViewRecipe({ userId: session?.user?.id ?? null, recipeId: id });
  const bundle = await getRecipeBundle(id);
  if (!bundle) notFound();
  const { recipe: r, steps } = bundle;

  const [ch] = await db.select().from(channel).where(eq(channel.id, r.channelId)).limit(1);
  if (!ch) notFound();

  if (!access.allowed) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{r.title}</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          This recipe is for channel members. Open the creator channel and use the demo subscribe toggle
          (Phase 1 — no real payments).
        </p>
        <Link href={`/c/${ch.slug}`} className="text-amber-300 underline">
          View {ch.title}
        </Link>
      </div>
    );
  }

  const totalDurationSeconds = steps.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

  return (
    <article className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/c/${ch.slug}`} className="text-sm font-medium text-amber-700 hover:text-amber-800 transition">
            {ch.title}
          </Link>
          {r.visibility === "members" && (
            <span className="text-xs px-2 py-1 bg-amber-200 text-amber-900 rounded-full font-medium">
              Member Only
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4 leading-tight">{r.title}</h1>
        {r.description && (
          <p className="text-lg text-neutral-700 max-w-2xl">{r.description}</p>
        )}
      </div>

      {/* Quick Stats */}
      {totalDurationMinutes > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs text-neutral-600 uppercase font-medium mb-1">Total Time</div>
            <div className="text-2xl font-bold text-amber-700">{totalDurationMinutes}m</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-neutral-600 uppercase font-medium mb-1">Steps</div>
            <div className="text-2xl font-bold text-amber-700">{steps.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-neutral-600 uppercase font-medium mb-1">Ingredients</div>
            <div className="text-2xl font-bold text-amber-700">{r.ingredients?.length ?? 0}</div>
          </div>
        </div>
      )}

      {/* Ingredients Section */}
      <section>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Ingredients</h2>
        <div className="card divide-y divide-neutral-700">
          {(r.ingredients ?? []).length === 0 ? (
            <div className="p-6 text-center text-neutral-600">
              <p>No ingredients listed for this recipe.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-300">
              {(r.ingredients ?? []).map((ing, i) => (
                <li key={i} className="p-4 hover:bg-neutral-100 transition">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded cursor-pointer accent-amber-700"
                      aria-label={`Check off ${ing.name}`}
                    />
                    <span className="text-neutral-900">
                      <span className="font-medium">{ing.amount}</span>
                      {ing.unit && <span className="text-neutral-600"> {ing.unit}</span>}
                      <span className="ml-2">{ing.name}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Steps Section */}
      <section>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Steps</h2>
        <div className="space-y-4">
          {steps.length === 0 ? (
            <div className="card p-6 text-center text-neutral-600">
              <p>No steps defined for this recipe.</p>
            </div>
          ) : (
            steps.map((s, idx) => {
              const stepDuration = s.durationSeconds ? Math.round(s.durationSeconds / 60) : null;
              return (
                <div key={s.id} className="card p-6 border-l-4 border-l-amber-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 text-amber-800 font-bold text-sm">
                          {idx + 1}
                        </span>
                        <h3 className="text-lg font-semibold text-neutral-900">{s.title}</h3>
                      </div>
                      <p className="text-neutral-700 mt-3 leading-relaxed">{s.instruction}</p>
                      {stepDuration && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2">
                          <span className="text-xl">⏱</span>
                          <span className="text-sm font-medium text-amber-800">
                            {stepDuration}m timer
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Cook Mode CTA */}
      <div className="sticky bottom-4 sm:relative pt-8 border-t border-neutral-300">
        {session?.user ? (
          <StartCookForm recipeId={r.id} />
        ) : (
          <div className="bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-300 rounded-lg p-6 text-center">
            <p className="text-neutral-800 mb-4">
              Sign in to start cook mode with timers and alerts.
            </p>
            <Link
              href="/sign-in"
              className="btn btn-primary font-semibold"
            >
              Sign In to Cook
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
