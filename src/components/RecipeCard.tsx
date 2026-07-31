import Link from "next/link";
import Image from "next/image";
import { CreatorLink } from "@/components/CreatorProfileBar";
import { RecipeImagePlaceholder } from "@/components/RecipeImagePlaceholder";

interface RecipeCardProps {
  id: string;
  title: string;
  description?: string | null;
  creatorName?: string | null;
  creatorSlug?: string | null;
  creatorAvatarUrl?: string | null;
  /** @deprecated use creatorName */
  authorName?: string | null;
  imageUrl?: string | null;
  /** Load the cover eagerly (set for above-the-fold cards; improves LCP). */
  priority?: boolean;
  cookTime?: number;
  prepTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  rating?: number;
  ratingCount?: number;
}

export function RecipeCard({
  id,
  title,
  description,
  creatorName,
  creatorSlug,
  creatorAvatarUrl,
  authorName,
  imageUrl,
  priority,
  cookTime,
  prepTime,
  difficulty,
  rating,
  ratingCount,
}: RecipeCardProps) {
  const displayCreator = creatorName ?? authorName;
  const totalTime = (prepTime || 0) + (cookTime || 0);
  const timeLabel = totalTime > 0 ? `${totalTime} min` : null;
  const uploadImage = Boolean(imageUrl?.includes("/api/files"));
  const difficultyColor = {
    easy: "text-sage",
    medium: "text-gold",
    hard: "text-terracotta",
  };

  return (
    <article>
      <Link href={`/recipe/${id}`} className="group block">
        {imageUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sunken ring-1 ring-black/5">
            <Image
              src={imageUrl}
              alt={title}
              fill
              priority={priority}
              unoptimized={uploadImage}
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {(difficulty || timeLabel) && (
              <div className="absolute right-2.5 top-2.5 flex flex-wrap justify-end gap-1.5">
                {difficulty ? (
                  <span
                    className={`rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold capitalize backdrop-blur ${difficultyColor[difficulty]}`}
                  >
                    {difficulty}
                  </span>
                ) : null}
                {timeLabel ? (
                  <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-[#fff8f0] backdrop-blur">
                    {timeLabel}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <RecipeImagePlaceholder />
        )}

        <h3 className="mt-3.5 line-clamp-2 pr-1 font-display text-[1.15rem] font-semibold leading-snug text-ink transition-colors group-hover:text-terracotta-strong">
          {title}
        </h3>
      </Link>

      {displayCreator && creatorSlug ? (
        <div className="mt-2">
          <CreatorLink
            channelSlug={creatorSlug}
            channelTitle={displayCreator}
            avatarUrl={creatorAvatarUrl}
          />
        </div>
      ) : displayCreator ? (
        <p className="mt-2 text-sm text-ink-muted">{displayCreator}</p>
      ) : null}

      {rating != null && ratingCount != null ? (
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gold" aria-hidden="true">
            <path d="M10 1.8l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.4l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.8z" />
          </svg>
          {rating.toFixed(1)} <span className="text-ink-muted">({ratingCount})</span>
        </p>
      ) : null}

      {description ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
    </article>
  );
}
