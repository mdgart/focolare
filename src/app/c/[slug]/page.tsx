import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelBySlug } from "@/actions/channels";
import { getDemoSubscriptionState, setDemoSubscriptionAction } from "@/actions/subscription";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";
import { RecipeCard } from "@/components/RecipeCard";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await getChannelBySlug(slug);
  if (!bundle) notFound();
  const { channel: ch, recipes } = bundle;
  const session = await getServerSession();
  const sub = await getDemoSubscriptionState(ch.id);

  const rows = await Promise.all(
    recipes.map(async (r) => {
      const access = await canViewRecipe({
        userId: session?.user?.id ?? null,
        recipeId: r.id,
      });
      return { r, locked: !access.allowed };
    }),
  );

  const memberRecipes = rows.filter((row) => row.r.visibility === "members");
  const publicRecipes = rows.filter((row) => row.r.visibility !== "members");

  return (
    <div className="space-y-12">
      {/* Creator Header */}
      <div className="border-b border-neutral-800 pb-12">
        <div className="flex items-start gap-6 mb-6">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-amber-700/20">
            {ch.title[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-neutral-900 mb-2">{ch.title}</h1>
            {ch.bio && <p className="text-lg text-neutral-700 max-w-2xl leading-relaxed">{ch.bio}</p>}
            <div className="flex items-center gap-6 mt-4 text-sm text-neutral-500">
              <span>📦 {recipes.length} recipes</span>
              <span>👥 {sub.active ? "You're a member" : "Free tier"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      {memberRecipes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-300 rounded-lg p-8">
          <div className="max-w-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-amber-900 mb-2">Member Recipes</h2>
                <p className="text-amber-900/70 mb-4">
                  {memberRecipes.length} exclusive recipe{memberRecipes.length === 1 ? "" : "s"} available to members. Subscribe to unlock all content.
                </p>
              </div>
              <div className="text-4xl">🔒</div>
            </div>

            {session?.user ? (
              <form
                action={async () => {
                  "use server";
                  await setDemoSubscriptionAction({ channelId: ch.id, active: !sub.active });
                }}
              >
                <button
                  type="submit"
                  className={`btn font-semibold transition ${
                    sub.active
                      ? "btn-secondary"
                      : "btn-primary"
                  }`}
                >
                  {sub.active ? "✓ You're a Member" : "Become a Member"}
                </button>
              </form>
            ) : (
              <Link href="/sign-in" className="btn btn-primary font-semibold inline-block">
                Sign in to Subscribe
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Public Recipes Section */}
      {publicRecipes.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">Free Recipes</h2>
            <p className="text-neutral-700 mt-1">Explore these recipes free of charge</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicRecipes.map(({ r }) => (
              <RecipeCard
                key={r.id}
                id={r.id}
                title={r.title}
                description={r.description}
                authorName={ch.title}
              />
            ))}
          </div>
        </section>
      )}

      {/* Member Recipes Section */}
      {memberRecipes.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">Member Recipes</h2>
            <p className="text-neutral-700 mt-1">Exclusive recipes for channel members</p>
          </div>

          {sub.active ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberRecipes
                .filter(({ locked }) => !locked)
                .map(({ r }) => (
                  <div key={r.id} className="relative">
                    <RecipeCard
                      id={r.id}
                      title={r.title}
                      description={r.description}
                      authorName={ch.title}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {memberRecipes.map(({ r }) => (
                <div key={r.id} className="card p-8 flex flex-col items-center justify-center text-center min-h-64 relative group">
                  <div className="absolute inset-0 bg-black/40 rounded-lg group-hover:bg-black/50 transition" />
                  <div className="relative z-10">
                    <div className="text-4xl mb-3">🔐</div>
                    <h3 className="font-semibold text-neutral-200 mb-2">{r.title}</h3>
                    <p className="text-sm text-neutral-400 mb-4">Member only</p>
                    <button className="btn btn-primary px-4 py-2 text-sm cursor-not-allowed opacity-70">
                      Locked
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {recipes.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h3 className="font-semibold text-neutral-900 mb-2">No recipes yet</h3>
          <p className="text-neutral-600">This creator hasn&apos;t published any recipes yet. Check back soon!</p>
          <div className="mt-6">
            <Link href="/" className="btn btn-secondary inline-block">
              Browse Other Recipes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
