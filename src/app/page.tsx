import Link from "next/link";
import { getActiveCookSessionForUser } from "@/actions/cook";
import { listPublishedRecipes } from "@/actions/recipes";
import { RecipeCard } from "@/components/RecipeCard";

export default async function HomePage() {
  const [active, picks] = await Promise.all([getActiveCookSessionForUser(), listPublishedRecipes()]);

  const categories = [
    { icon: "🍞", name: "Bread", href: "/discover?category=bread", color: "from-orange-900 to-orange-800" },
    { icon: "🎂", name: "Baking", href: "/discover?category=baking", color: "from-amber-900 to-amber-800" },
    { icon: "🍳", name: "Cooking", href: "/discover?category=cooking", color: "from-rose-900 to-rose-800" },
    { icon: "🧂", name: "Curing", href: "/discover?category=curing", color: "from-red-900 to-red-800" },
    { icon: "🥒", name: "Preserving", href: "/discover?category=preserving", color: "from-green-900 to-green-800" },
    { icon: "🍰", name: "Desserts", href: "/discover?category=desserts", color: "from-yellow-900 to-yellow-800" },
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
              className="btn btn-primary text-base"
            >
              Explore Recipes
            </Link>
            {active ? (
              <Link
                href={`/cook/${active.id}`}
                className="btn btn-secondary text-base"
              >
                Resume Cooking →
              </Link>
            ) : (
              <Link
                href="/create/recipe"
                className="btn btn-secondary text-base"
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
                className="btn btn-primary text-sm"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group relative overflow-hidden rounded-lg p-6 text-center transition-all hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105 bg-gradient-to-br ${cat.color} border border-black/20`}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
              <div className="relative z-10">
                <div className="text-5xl mb-3">{cat.icon}</div>
                <div className="text-base font-semibold text-white/90 group-hover:text-white transition">
                  {cat.name}
                </div>
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
              className="btn btn-primary inline-block"
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
          className="btn btn-primary inline-block"
        >
          Sign Up Free
        </Link>
      </section>
    </div>
  );
}
