import Link from "next/link";
import { getHomeIntroHiddenForUser } from "@/actions/account";
import { listOngoingPreparationsForUser } from "@/actions/preparations";
import { listPublishedRecipes } from "@/actions/recipes";
import { getServerSession } from "@/lib/session";
import { CategoryTiles } from "@/components/CategoryTiles";
import { HomeHero } from "@/components/HomeHero";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeSearchForm } from "@/components/RecipeSearchForm";
import { SectionHeading } from "@/components/SectionHeading";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await getServerSession();
  const [preparations, picks, hideHomeIntro] = await Promise.all([
    session?.user ? listOngoingPreparationsForUser() : Promise.resolve([]),
    listPublishedRecipes({ q }),
    session?.user ? getHomeIntroHiddenForUser() : Promise.resolve(false),
  ]);

  const categories = [
    { name: "Baking", href: "/discover?category=baking", image: "/baking.jpg" },
    { name: "Fermenting", href: "/discover?category=fermenting", image: "/fermentation.jpg" },
    { name: "Cooking", href: "/discover?category=cooking", image: "/cooking.jpg" },
    { name: "Curing", href: "/discover?category=curing", image: "/curing.jpg" },
    { name: "Preserving", href: "/discover?category=preserving", image: "/preserve.jpg" },
    { name: "Desserts", href: "/discover?category=desserts", image: "/dessert.jpg" },
  ];

  const query = q?.trim();

  return (
    <div className="min-w-0 space-y-12 sm:space-y-16">
      <HomeHero
        preparationCount={preparations.length}
        initialHidden={hideHomeIntro}
        isLoggedIn={Boolean(session?.user)}
      />

      <div className="mx-auto w-full max-w-2xl">
        <RecipeSearchForm action="/" defaultQuery={q ?? ""} />
      </div>

      <section>
        <SectionHeading eyebrow="Browse by craft" title="What are you making?" />
        <div className="mt-6">
          <CategoryTiles categories={categories} />
        </div>
      </section>

      <section>
        {query ? (
          <SectionHeading
            eyebrow="Search"
            title={`Results for “${query}”`}
            aside={
              <Link href="/" className="text-sm font-medium text-terracotta hover:text-terracotta-strong">
                Clear search
              </Link>
            }
          />
        ) : (
          <SectionHeading
            eyebrow="Fresh from the hearth"
            title="Latest recipes"
            aside={
              <Link
                href="/discover"
                className="text-sm font-medium text-terracotta hover:text-terracotta-strong"
              >
                View all →
              </Link>
            }
          />
        )}

        {picks.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-sand-strong bg-surface/60 py-16 text-center">
            <p className="text-ink-soft">
              {query ? `Nothing found for “${query}”.` : "No recipes yet — the hearth is waiting."}
            </p>
            {query ? (
              <Link href="/" className="btn btn-secondary mt-5 inline-flex">
                Clear search
              </Link>
            ) : (
              <Link href="/create/recipe" className="btn btn-primary mt-5 inline-flex">
                Create the first recipe
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {picks.map((recipe, i) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                slug={recipe.slug}
                title={recipe.title}
                description={recipe.description}
                creatorName={recipe.channelTitle}
                creatorSlug={recipe.channelSlug}
                creatorAvatarUrl={recipe.channelAvatarUrl}
                imageUrl={recipe.coverPublicUrl ?? undefined}
                priority={i < 3}
              />
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] bg-terracotta-strong px-6 py-12 text-center sm:px-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c9ae]">
          Grow the taxonomy
        </p>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl text-[#fff5ea] sm:text-4xl">
          Your craft deserves a shelf here
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#f6ddc9] sm:text-base">
          Koji butter? Alpine cheesemaking? If your specialty doesn&apos;t fit our categories,
          propose a new one and help the community find its people.
        </p>
        <Link
          href="/taxonomy/suggest?from=/"
          className="btn mt-7 inline-flex bg-[#fff5ea] text-terracotta-strong hover:bg-white"
        >
          Suggest a category
        </Link>
      </section>
    </div>
  );
}
