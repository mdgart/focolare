import Link from "next/link";
import { getActiveCookSessionForUser } from "@/actions/cook";
import { listPublishedRecipes } from "@/actions/recipes";

export default async function HomePage() {
  const [active, picks] = await Promise.all([getActiveCookSessionForUser(), listPublishedRecipes()]);
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-amber-50">Cook with confidence</h1>
        <p className="text-neutral-400">
          Focolare turns recipes into timed checklists: ready-by scheduling, step timers, and push alerts
          (when configured).
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/discover"
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400"
          >
            Browse recipes
          </Link>
          {active ? (
            <Link
              href={`/cook/${active.id}`}
              className="rounded-full border border-amber-500/50 px-4 py-2 text-sm text-amber-100 hover:border-amber-400"
            >
              Continue cooking
            </Link>
          ) : null}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Fresh picks</h2>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/40">
          {picks.length === 0 ? (
            <li className="px-4 py-6 text-neutral-500">No public recipes yet. Be the first to publish.</li>
          ) : (
            picks.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={`/recipe/${r.id}`} className="block px-4 py-3 hover:bg-neutral-800/60">
                  <div className="font-medium text-neutral-100">{r.title}</div>
                  {r.description ? (
                    <div className="line-clamp-2 text-sm text-neutral-500">{r.description}</div>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
