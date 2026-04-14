import Link from "next/link";
import { getActiveCookSessionForUser } from "@/actions/cook";
import { listPublishedRecipes } from "@/actions/recipes";
import { RecipeCard } from "@/components/RecipeCard";

export default async function HomePage() {
  const [active, picks] = await Promise.all([getActiveCookSessionForUser(), listPublishedRecipes()]);

  const categories = [
    { icon: "🍞", name: "Bread", href: "/discover?category=bread", color: "from-amber-400 to-amber-500", textColor: "text-white" },
    { icon: "🎂", name: "Baking", href: "/discover?category=baking", color: "from-orange-400 to-yellow-500", textColor: "text-white" },
    { icon: "🍳", name: "Cooking", href: "/discover?category=cooking", color: "from-red-400 to-orange-500", textColor: "text-white" },
    { icon: "🧂", name: "Curing", href: "/discover?category=curing", color: "from-green-500 to-emerald-600", textColor: "text-white" },
    { icon: "🥒", name: "Preserving", href: "/discover?category=preserving", color: "from-emerald-500 to-teal-600", textColor: "text-white" },
    { icon: "🍰", name: "Desserts", href: "/discover?category=desserts", color: "from-pink-400 to-rose-500", textColor: "text-white" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="py-12 sm:py-20">
        <div className="max-w-4xl">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-neutral-900 mb-6 leading-tight">
            Cook with <span className="text-orange-600 font-black">confidence</span>
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 mb-8 max-w-4xl leading-relaxed">
            Focolare guides you through every recipe with automated timers, alerts, and smart scheduling. Just set when you want your dish ready—we&apos;ll tell you when to start.
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
        <section className="bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-300 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">👨‍🍳</div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">You&apos;re in the middle of cooking!</h3>
              <p className="text-sm text-amber-800/70 mb-4">Continue where you left off and stay on track with automated timers.</p>
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group relative overflow-hidden rounded-lg p-6 text-center transition-all hover:shadow-lg hover:scale-105 bg-gradient-to-br ${cat.color} border border-neutral-400 group-hover:border-neutral-500`}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
              <div className="relative z-10">
                <div className="text-5xl mb-3">{cat.icon}</div>
                <div className={`text-base font-semibold ${cat.textColor} group-hover:opacity-80 transition`}>
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
            <h2 className="text-2xl font-bold text-neutral-900">Fresh Picks</h2>
            <p className="text-sm text-neutral-600 mt-1">Recently published recipes from our community</p>
          </div>
          <Link href="/discover" className="text-amber-700 hover:text-amber-800 font-medium text-sm">
            View all →
          </Link>
        </div>

        {picks.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📖</div>
            <h3 className="font-semibold text-neutral-900 mb-2">No recipes yet</h3>
            <p className="text-neutral-600 mb-6">Be the first to share a recipe with the community!</p>
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
      <section className="py-12 bg-gradient-to-r from-amber-100 via-yellow-100 to-orange-100 border border-amber-300 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-amber-900 mb-3">Ready to start cooking?</h2>
        <p className="text-neutral-700 mb-6 max-w-md mx-auto">
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
