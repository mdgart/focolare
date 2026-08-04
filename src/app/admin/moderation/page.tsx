import Image from "next/image";
import Link from "next/link";
import { listRecipesForReview } from "@/actions/moderation";
import { isAiRecipeEnabled } from "@/lib/openai";
import { recipeHref } from "@/lib/recipe-url";
import { ReviewButtons } from "./review-buttons";

export const metadata = { title: "Moderation · Focolare admin" };

function scoreLabel(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export default async function ModerationPage() {
  const items = await listRecipesForReview();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl">Flagged recipes</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Recipes held back by the automatic safety check. They stay out of Discover, search, and
          channel listings until you decide. Authors can still open and edit their own.
        </p>
        {!isAiRecipeEnabled() ? (
          <p className="mt-3 rounded-2xl border border-sand-strong bg-sunken px-4 py-3 text-sm text-ink-soft">
            Automatic checks are <strong className="text-ink">off</strong> — no{" "}
            <code className="text-xs">OPENAI_API_KEY</code> is configured, so new submissions publish
            without screening.
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-14 text-center">
          <p className="text-ink-soft">Nothing waiting for review.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-4 rounded-2xl border border-sand bg-surface p-4 sm:flex-row sm:p-5"
            >
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-sunken sm:w-40">
                {r.coverPublicUrl ? (
                  <Image src={r.coverPublicUrl} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-ink-muted">
                    No photo
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                      r.moderationStatus === "rejected"
                        ? "bg-red-100 text-red-900"
                        : "bg-terracotta-tint text-terracotta-strong"
                    }`}
                  >
                    {r.moderationStatus}
                  </span>
                  <Link
                    href={recipeHref({ recipeId: r.id, channelSlug: r.channelSlug, recipeSlug: r.slug })}
                    className="font-display text-lg font-semibold text-ink hover:text-terracotta-strong"
                  >
                    {r.title}
                  </Link>
                </div>

                <p className="mt-1 text-sm text-ink-muted">
                  by{" "}
                  <Link href={`/c/${r.channelSlug}`} className="hover:text-terracotta-strong">
                    {r.channelTitle}
                  </Link>
                  {r.moderatedAt ? ` · ${new Date(r.moderatedAt).toLocaleString()}` : null}
                </p>

                {r.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.description}</p>
                ) : null}

                {r.moderationFlags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.moderationFlags.map((f) => (
                      <span
                        key={f.category}
                        className="rounded-full border border-sand-strong bg-sunken px-2.5 py-1 text-xs font-medium text-ink-soft"
                        title={`Confidence ${scoreLabel(f.score)}`}
                      >
                        {f.category}
                        {f.score > 0 ? (
                          <span className="ml-1 tabular-nums text-ink-muted">{scoreLabel(f.score)}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="sm:self-center">
                <ReviewButtons recipeId={r.id} status={r.moderationStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
