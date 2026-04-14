import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelBySlug } from "@/actions/channels";
import { getDemoSubscriptionState, setDemoSubscriptionAction } from "@/actions/subscription";
import { canViewRecipe } from "@/lib/recipe-access";
import { getServerSession } from "@/lib/session";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{ch.title}</h1>
        {ch.bio ? <p className="mt-2 text-neutral-400">{ch.bio}</p> : null}
      </div>
      {session?.user ? (
        <form
          className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm"
          action={async () => {
            "use server";
            await setDemoSubscriptionAction({ channelId: ch.id, active: !sub.active });
          }}
        >
          <span className="text-neutral-400">Demo membership (no payment)</span>
          <button
            type="submit"
            className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-neutral-950 hover:bg-amber-400"
          >
            {sub.active ? "Unsubscribe" : "Subscribe"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-neutral-500">
          <Link href="/sign-in" className="text-amber-300 underline">
            Sign in
          </Link>{" "}
          to toggle demo membership.
        </p>
      )}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Recipes</h2>
        <ul className="space-y-2">
          {rows.length === 0 ? (
            <li className="text-neutral-500">No recipes yet.</li>
          ) : (
            rows.map(({ r, locked }) => (
              <li key={r.id}>
                {locked ? (
                  <div className="block cursor-not-allowed rounded-lg border border-neutral-800 px-4 py-3 opacity-60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.title}</span>
                      {r.visibility === "members" ? (
                        <span className="text-xs text-amber-200">Members</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Subscribe with demo toggle to open.</p>
                  </div>
                ) : (
                  <Link
                    href={`/recipe/${r.id}`}
                    className="block rounded-lg border border-neutral-800 px-4 py-3 hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.title}</span>
                      {r.visibility === "members" ? (
                        <span className="text-xs text-amber-200">Member (unlocked)</span>
                      ) : null}
                    </div>
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
