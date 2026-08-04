import Link from "next/link";
import { redirect } from "next/navigation";
import { listSavedRecipes } from "@/actions/saved";
import { RecipeCard } from "@/components/RecipeCard";
import { getServerSession } from "@/lib/session";

export const metadata = { title: "Saved · Focolare" };

export default async function SavedPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in?next=/saved");

  const items = await listSavedRecipes();

  return (
    <div className="min-w-0 space-y-8">
      <div className="max-w-2xl pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Your kitchen
        </p>
        <h1 className="text-3xl sm:text-4xl">Saved recipes</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          {items.length > 0
            ? "Recipes you've bookmarked to cook later."
            : "Bookmark recipes as you browse and they'll gather here."}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-16 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-strong">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M5.5 3.5h9a1 1 0 0 1 1 1v12l-5.5-3.2L4.5 16.5v-12a1 1 0 0 1 1-1z" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 className="mb-2">Nothing saved yet</h3>
          <p className="mx-auto mb-6 max-w-sm text-ink-soft">
            Tap <strong className="text-ink">Save</strong> on any recipe to keep it here.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Browse recipes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((r, i) => (
            <RecipeCard
              key={r.id}
              id={r.id}
              slug={r.slug}
              title={r.title}
              description={r.description}
              creatorName={r.channelTitle}
              creatorSlug={r.channelSlug}
              imageUrl={r.coverPublicUrl ?? undefined}
              priority={i < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
