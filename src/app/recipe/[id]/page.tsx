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

  return (
    <article className="space-y-6">
      <div>
        <Link href={`/c/${ch.slug}`} className="text-sm text-amber-300 hover:underline">
          {ch.title}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{r.title}</h1>
        {r.visibility === "members" ? (
          <p className="mt-2 text-xs uppercase tracking-wide text-amber-200/80">Member recipe</p>
        ) : null}
      </div>
      {r.description ? <p className="text-neutral-300">{r.description}</p> : null}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-neutral-500">Ingredients</h2>
        <ul className="list-inside list-disc space-y-1 text-neutral-200">
          {(r.ingredients ?? []).map((ing, i) => (
            <li key={i}>
              {ing.amount ? `${ing.amount} ` : ""}
              {ing.unit ? `${ing.unit} ` : ""}
              {ing.name}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-neutral-500">Steps</h2>
        <ol className="space-y-3">
          {steps.map((s, idx) => (
            <li key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="text-xs text-neutral-500">Step {idx + 1}</div>
              <div className="font-medium">{s.title}</div>
              <p className="mt-1 text-sm text-neutral-300">{s.instruction}</p>
              {s.durationSeconds != null && s.durationSeconds > 0 ? (
                <p className="mt-2 text-xs text-amber-200/90">Timer: {s.durationSeconds}s</p>
              ) : null}
              {idx > 0 && s.offsetFromPrevious > 0 ? (
                <p className="text-xs text-neutral-500">After previous: wait {s.offsetFromPrevious}s</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {session?.user ? (
        <StartCookForm recipeId={r.id} />
      ) : (
        <p className="text-sm text-neutral-500">
          <Link href="/sign-in" className="text-amber-300 underline">
            Sign in
          </Link>{" "}
          to start cook mode.
        </p>
      )}
    </article>
  );
}
