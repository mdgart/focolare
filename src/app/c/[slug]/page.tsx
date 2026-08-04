import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelBySlug } from "@/actions/channels";
import { CreatorProfileBar } from "@/components/CreatorProfileBar";
import { getServerSession } from "@/lib/session";
import { RecipeCard } from "@/components/RecipeCard";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession();
  const bundle = await getChannelBySlug(slug, { viewerUserId: session?.user?.id ?? null });
  if (!bundle) notFound();
  const { channel: ch, recipes, followerCount, following, isOwner, avatarPublicUrl } = bundle;

  return (
    <div className="space-y-10">
      <header className="border-b border-neutral-200 pb-8">
        <CreatorProfileBar
          channelId={ch.id}
          channelSlug={ch.slug}
          channelTitle={ch.title}
          avatarUrl={avatarPublicUrl}
          followerCount={followerCount}
          following={following}
          isOwner={isOwner}
          isLoggedIn={Boolean(session?.user)}
          signInHref={`/sign-in?next=/c/${ch.slug}`}
        />
        {ch.bio ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-700">{ch.bio}</p> : null}
        <p className="mt-4 text-sm text-neutral-500">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </p>
      </header>

      {recipes.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-neutral-600">No recipes published yet.</p>
          {isOwner ? (
            <Link href="/create/recipe" className="btn btn-primary mt-4 inline-block">
              Create your first recipe
            </Link>
          ) : (
            <Link href="/discover" className="btn btn-secondary mt-4 inline-block">
              Browse recipes
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              id={r.id}
              slug={r.slug}
              title={r.title}
              description={r.description}
              creatorName={ch.title}
              creatorSlug={ch.slug}
              creatorAvatarUrl={avatarPublicUrl}
              imageUrl={r.coverPublicUrl ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
