import Link from "next/link";
import Image from "next/image";

interface RecipeCardProps {
  id: string;
  title: string;
  description?: string | null;
  authorName?: string | null;
  imageUrl?: string | null;
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
  authorName,
  imageUrl,
  cookTime,
  prepTime,
  difficulty,
  rating,
  ratingCount,
}: RecipeCardProps) {
  const totalTime = (prepTime || 0) + (cookTime || 0);
  const timeLabel = totalTime > 0 ? `${totalTime}m` : null;
  const difficultyColor = {
    easy: "bg-green-900/40 text-green-200",
    medium: "bg-amber-900/40 text-amber-200",
    hard: "bg-red-900/40 text-red-200",
  };

  return (
    <Link href={`/recipe/${id}`}>
      <article className="card overflow-hidden group">
        {/* Image Container */}
        {imageUrl ? (
          <div className="relative h-40 bg-neutral-800 overflow-hidden">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {/* Badges overlay */}
            <div className="absolute top-3 right-3 flex flex-wrap gap-2 justify-end">
              {difficulty && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${difficultyColor[difficulty]}`}>
                  {difficulty}
                </span>
              )}
              {timeLabel && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-black/50 text-neutral-100">
                  ⏱ {timeLabel}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-neutral-800 to-neutral-700 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🍳</div>
              <p className="text-xs text-neutral-500">No image</p>
            </div>
          </div>
        )}

        {/* Content Container */}
        <div className="p-4">
          <h3 className="font-semibold text-neutral-100 line-clamp-2 mb-2 group-hover:text-amber-200 transition">
            {title}
          </h3>

          {description && (
            <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{description}</p>
          )}

          {/* Metadata Row */}
          <div className="flex items-center justify-between gap-2 text-xs text-neutral-400 mb-3">
            {authorName && <span>by {authorName}</span>}
            {rating !== undefined && ratingCount !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-amber-400">★</span>
                <span>
                  {rating.toFixed(1)} ({ratingCount})
                </span>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="pt-3 border-t border-neutral-700/50">
            <span className="text-sm font-medium text-amber-300 group-hover:text-amber-200 transition">
              View recipe →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
