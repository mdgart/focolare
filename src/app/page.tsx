import Link from "next/link";
import { getActiveCookSessionForUser } from "@/actions/cook";
import { listPublishedRecipes } from "@/actions/recipes";
import { RecipeCard } from "@/components/RecipeCard";

export default async function HomePage() {
  const [active, picks] = await Promise.all([getActiveCookSessionForUser(), listPublishedRecipes()]);

  const categories = [
    { name: "🍞 Bread", href: "/discover?category=bread" },
    { name: "🎂 Baking", href: "/discover?category=baking" },
    { name: "🍳 Cooking", href: "/discover?category=cooking" },
    { name: "🧂 Curing", href: "/discover?category=curing" },
    { name: "🥒 Preserving", href: "/discover?category=preserving" },
    { name: "🍰 Desserts", href: "/discover?category=desserts" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="py-8 sm:py-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-100 mb-4 leading-tight">
            Cook with <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">confidence</span>
          </h1>
          <p className="text-lg text-neutral-400 mb-6 max-w-lg leading-relaxed">
            Focolare guides you through every recipe step with automated timers, persistent alerts, and smart scheduling. Just set when you want it ready, and we&apos;ll tell you when to start.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/discover"
              className="btn btn-primary px-6 py-3 text-base shadow-lg shadow-orange-500/20"
            >
              Explore Recipes
            </Link>
            {active ? (
              <Link
                href={`/cook/${active.id}`}
                className="btn btn-secondary px-6 py-3 text-base"
              >
                Resume Cooking →
              </Link>
            ) : (
              <Link
                href="/create/recipe"
                className="btn btn-secondary px-6 py-3 text-base"
              >
                Create Your First Recipe
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Active Cook Session Alert */}
      {active && (
        <section className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/40 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">👨‍🍳</div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-100 mb-1">You&apos;re in the middle of cooking!</h3>
              <p className="text-sm text-amber-200/80 mb-4">Continue where you left off and stay on track with automated timers.</p>
              <Link
                href={`/cook/${active.id}`}
                className="btn btn-primary px-4 py-2 text-sm"
              >
                Continue Cooking
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Category Browse */}
      <section>
        <h2 className="text-2xl font-bold text-neutral-100 mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group card p-4 text-center hover:border-amber-600/50"
            >
              <div className="text-3xl mb-2">{cat.name.split(" ")[0]}</div>
              <div className="text-sm font-medium text-neutral-300 group-hover:text-amber-200 transition">
                {cat.name.split(" ")[1]}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Recipes */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100">Fresh Picks</h2>
            <p className="text-sm text-neutral-500 mt-1">Recently published recipes from our community</p>
          </div>
          <Link href="/discover" className="text-amber-300 hover:text-amber-200 font-medium text-sm">
            View all →
          </Link>
        </div>

        {picks.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📖</div>
            <h3 className="font-semibold text-neutral-200 mb-2">No recipes yet</h3>
            <p className="text-neutral-500 mb-6">Be the first to share a recipe with the community!</p>
            <Link
              href="/create/recipe"
              className="btn btn-primary px-6 py-2 inline-block"
            >
              Create Recipe
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {picks.slice(0, 9).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                description={recipe.description}
              />
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-gradient-to-r from-orange-900/20 via-amber-900/20 to-yellow-900/20 border border-orange-700/30 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-100 mb-3">Ready to start cooking?</h2>
        <p className="text-neutral-400 mb-6 max-w-md mx-auto">
          Join our community of home cooks, bakers, and culinary explorers. Share your recipes or discover new ones.
        </p>
        <Link
          href="/sign-up"
          className="btn btn-primary px-8 py-3 font-semibold shadow-lg shadow-orange-500/20 inline-block"
        >
          Sign Up Free
        </Link>
      </section>
    </div>
  );
}
