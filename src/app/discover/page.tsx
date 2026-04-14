import Link from "next/link";
import { listPublishedRecipes } from "@/actions/recipes";
import { RecipeCard } from "@/components/RecipeCard";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const recipes = await listPublishedRecipes({ q });

  const categories = [
    { id: "bread", name: "🍞 Bread" },
    { id: "baking", name: "🎂 Baking" },
    { id: "cooking", name: "🍳 Cooking" },
    { id: "curing", name: "🧂 Curing" },
    { id: "preserving", name: "🥒 Preserving" },
    { id: "desserts", name: "🍰 Desserts" },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-bold text-neutral-100 mb-2">Discover Recipes</h1>
        <p className="text-neutral-400">
          Explore our community&apos;s recipes and find your next culinary inspiration.
        </p>
      </div>

      {/* Search Bar */}
      <form className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by recipe name, ingredient, creator…"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm outline-none ring-amber-500/40 focus:ring-2 transition placeholder-neutral-600"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600">🔍</span>
          </div>
          <button
            type="submit"
            className="btn btn-primary px-6 py-3 font-medium shadow-lg shadow-orange-500/20"
          >
            Search
          </button>
        </div>
      </form>

      {/* Category Filter */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
          Browse by Category
        </h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/discover"
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              !category
                ? "bg-amber-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            All Recipes
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/discover?category=${cat.id}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                category === cat.id
                  ? "bg-amber-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">
              {q ? `Results for "${q}"` : "All Recipes"}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} found
            </p>
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-semibold text-neutral-200 mb-2">No recipes found</h3>
            <p className="text-neutral-500 mb-6">
              {q
                ? `Try adjusting your search or browse by category.`
                : "Be the first to create a recipe in this category!"}
            </p>
            <Link
              href="/create/recipe"
              className="btn btn-primary px-6 py-2 inline-block"
            >
              Create Recipe
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                description={recipe.description}
                authorEmail={recipe.authorEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
