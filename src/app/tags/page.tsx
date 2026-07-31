import Link from "next/link";
import { listPublicTagCounts, type TagWithCount } from "@/actions/tags";
import { SectionHeading } from "@/components/SectionHeading";

/**
 * Four visual weights driven by how often a tag is used. Every tier keeps a
 * comfortable tap target — only type size, weight and fill vary.
 */
function tierFor(count: number, max: number): { text: string; look: string } {
  const t = max > 0 ? count / max : 0;
  if (t > 0.66) {
    return {
      text: "text-xl sm:text-2xl font-semibold",
      look: "bg-terracotta text-[#fff8f0] border-transparent hover:bg-terracotta-strong",
    };
  }
  if (t > 0.4) {
    return {
      text: "text-lg font-semibold",
      look: "bg-terracotta-tint text-terracotta-strong border-terracotta/40 hover:bg-[#f0d9c4]",
    };
  }
  if (t > 0.2) {
    return {
      text: "text-base font-medium",
      look: "bg-surface text-ink border-sand-strong hover:border-terracotta hover:text-terracotta-strong",
    };
  }
  return {
    text: "text-sm font-medium",
    look: "bg-surface text-ink-soft border-sand hover:border-terracotta hover:text-terracotta-strong",
  };
}

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim();
  const tags = await listPublicTagCounts({ search: query });
  const max = tags.reduce((m, t) => Math.max(m, t.count), 0);
  const totalUses = tags.reduce((sum, t) => sum + t.count, 0);
  const popular: TagWithCount[] = [...tags].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="min-w-0 space-y-10 sm:space-y-12">
      <div className="max-w-2xl pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          The index
        </p>
        <h1 className="text-3xl sm:text-4xl">Recipe tags</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Every tag here comes from a published recipe — bigger means more cooks have used it. Pick
          one to filter Discover.
        </p>
      </div>

      {/* Search */}
      <form action="/tags" method="get" className="max-w-xl">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-sand-strong bg-surface py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/20 sm:pl-5">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-5 w-5 shrink-0 text-ink-muted"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5.75" />
            <path d="M13.5 13.5L17 17" strokeLinecap="round" />
          </svg>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Filter tags…"
            aria-label="Filter tags"
            className="min-w-0 flex-1 bg-transparent py-2 text-[0.95rem] text-ink outline-none placeholder:text-ink-muted focus-visible:outline-none"
          />
          <button type="submit" className="btn btn-primary shrink-0 !px-5 !py-2 text-sm sm:!px-6 sm:!py-2.5">
            Search
          </button>
        </div>
        {query ? (
          <Link
            href="/tags"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
          >
            Clear filter
            <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>
        ) : null}
      </form>

      {tags.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-16 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-strong">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M3 8.5V4a1 1 0 0 1 1-1h4.5a1 1 0 0 1 .7.3l7.5 7.5a1 1 0 0 1 0 1.4l-4.5 4.5a1 1 0 0 1-1.4 0L3.3 9.2a1 1 0 0 1-.3-.7z" strokeLinejoin="round" />
              <circle cx="6.75" cy="6.75" r="1.15" />
            </svg>
          </span>
          <h3 className="mb-2">{query ? "No tags match that" : "No tags yet"}</h3>
          <p className="mx-auto mb-6 max-w-sm text-ink-soft">
            {query
              ? "Try a shorter word, or browse the full list."
              : "Tags appear here once recipes are published with them. Add comma-separated tags when you publish."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {query ? (
              <Link href="/tags" className="btn btn-secondary">
                Show all tags
              </Link>
            ) : null}
            <Link href="/create/recipe" className="btn btn-primary">
              Create a recipe
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Most used — a quick way in without scanning the cloud */}
          {!query && popular.length > 1 ? (
            <section>
              <SectionHeading eyebrow="Start here" title="Most used" />
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {popular.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/discover?tag=${encodeURIComponent(t.slug)}`}
                    className="group rounded-2xl border border-sand bg-surface px-4 py-4 transition hover:border-terracotta hover:shadow-sm"
                  >
                    <span className="block truncate font-display text-lg font-semibold text-ink transition group-hover:text-terracotta-strong">
                      {t.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {t.count} {t.count === 1 ? "recipe" : "recipes"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* The cloud */}
          <section>
            <SectionHeading
              eyebrow={query ? "Matching" : "Everything"}
              title={query ? `Tags matching “${query}”` : "All tags"}
              aside={
                <span className="text-sm text-ink-muted">
                  {tags.length} {tags.length === 1 ? "tag" : "tags"} · {totalUses} uses
                </span>
              }
            />
            <div className="mt-6 rounded-3xl border border-sand bg-surface px-5 py-7 sm:px-8 sm:py-9">
              <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {tags.map((t) => {
                  const tier = tierFor(t.count, max);
                  return (
                    <li key={t.slug}>
                      <Link
                        href={`/discover?tag=${encodeURIComponent(t.slug)}`}
                        className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border px-4 py-2 transition ${tier.text} ${tier.look}`}
                      >
                        {t.label}
                        <span className="text-xs font-normal opacity-70 tabular-nums">{t.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </>
      )}

      <p className="text-center text-sm text-ink-muted">
        Looking for something specific?{" "}
        <Link href="/discover" className="font-medium text-terracotta hover:text-terracotta-strong">
          Browse all recipes →
        </Link>
      </p>
    </div>
  );
}
