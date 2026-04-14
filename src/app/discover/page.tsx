import Link from "next/link";
import { listPublishedRecipes } from "@/actions/recipes";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const recipes = await listPublishedRecipes({ q });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Discover</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search recipes…"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none ring-amber-500/40 focus:ring-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400"
        >
          Search
        </button>
      </form>
      <ul className="space-y-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipe/${r.id}`}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-amber-500/40"
            >
              <div className="font-medium">{r.title}</div>
              {r.description ? (
                <div className="line-clamp-2 text-sm text-neutral-500">{r.description}</div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
