import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { listPublishedRecipes } from "@/actions/recipes";
import { listActiveCategories } from "@/actions/taxonomy";
import { db } from "@/db";
import { taxonomyCategory } from "@/db/schema";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeSearchForm } from "@/components/RecipeSearchForm";
import { SectionHeading } from "@/components/SectionHeading";

type TaxonomyRow = Awaited<ReturnType<typeof listActiveCategories>>[number];

function discoverHref(params: { q?: string; taxonomy?: string; tag?: string; category?: string }) {
  const sp = new URLSearchParams();
  const q = params.q?.trim();
  const taxonomy = params.taxonomy?.trim();
  const tag = params.tag?.trim();
  const category = params.category?.trim();
  if (q) sp.set("q", q);
  if (taxonomy) sp.set("taxonomy", taxonomy);
  if (category) sp.set("category", category);
  if (tag) sp.set("tag", tag);
  const qs = sp.toString();
  return qs ? `/discover?${qs}` : "/discover";
}

/** Parent id whose subcategories should appear in the second row (after picking that branch). */
function expandedParentIdForSubcategories(taxonomyId: string | undefined, categories: TaxonomyRow[]): string | null {
  if (!taxonomyId?.trim()) return null;
  const id = taxonomyId.trim();
  const selected = categories.find((c) => c.id === id);
  if (!selected) return null;
  const ownChildren = categories.filter((c) => c.parentId === selected.id);
  if (ownChildren.length > 0) return selected.id;
  if (selected.parentId) return selected.parentId;
  return null;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    taxonomy?: string;
    tag?: string;
    category?: string;
    categorySuggested?: string;
  }>;
}) {
  const { q, taxonomy, tag, category: categorySlugParam, categorySuggested } = await searchParams;
  const taxonomyTrimDirect = taxonomy?.trim();
  const categorySlug = categorySlugParam?.trim();

  let taxonomyCategoryId = taxonomyTrimDirect || undefined;
  if (!taxonomyCategoryId && categorySlug) {
    const [row] = await db
      .select({ id: taxonomyCategory.id })
      .from(taxonomyCategory)
      .where(and(eq(taxonomyCategory.slug, categorySlug), eq(taxonomyCategory.isActive, true)))
      .limit(1);
    taxonomyCategoryId = row?.id;
  }

  const recipes = await listPublishedRecipes({
    q,
    taxonomyCategoryId,
    tagSlug: tag?.trim() || undefined,
  });

  const categories = await listActiveCategories();
  const roots = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  /** Resolved category id (uuid) for filters and UI selection, whether the URL used `taxonomy` or `category` slug. */
  const selectedTaxonomyId = taxonomyCategoryId;
  const selectedCategory = selectedTaxonomyId
    ? categories.find((c) => c.id === selectedTaxonomyId)
    : undefined;
  const expandedParentId = expandedParentIdForSubcategories(selectedTaxonomyId, categories);
  const subPills = expandedParentId ? childrenOf(expandedParentId) : [];
  const expandedParent = expandedParentId ? categories.find((c) => c.id === expandedParentId) : undefined;

  const resultsTitle = q
    ? `Results for “${q}”`
    : tag
      ? `Tagged “${tag}”`
      : selectedCategory
        ? selectedCategory.label
        : "All recipes";
  const countLabel = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;

  return (
    <div className="min-w-0 space-y-10 sm:space-y-12">
      <div className="max-w-2xl pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          The pantry
        </p>
        <h1 className="text-3xl sm:text-4xl">Discover recipes</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Browse the community&apos;s crafts — from quick weeknight cooking to slow ferments and
          patient cures.
        </p>
      </div>

      {categorySuggested ? (
        <p className="rounded-2xl border border-sage/40 bg-[#eef2ea] px-5 py-4 text-sm text-ink">
          Thanks — your category suggestion was saved as <strong>pending</strong>. An admin can
          approve it so it appears in the lists below.
        </p>
      ) : null}

      <div className="max-w-2xl">
        <RecipeSearchForm
          defaultQuery={q ?? ""}
          hiddenFields={{
            ...(selectedTaxonomyId ? { taxonomy: selectedTaxonomyId } : {}),
            ...(tag ? { tag } : {}),
          }}
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            Browse by craft
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tags"
              className="rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
            >
              Tag cloud →
            </Link>
            <Link
              href="/taxonomy/suggest?from=/discover"
              className="rounded-full border border-terracotta/50 bg-terracotta-tint px-3.5 py-1.5 text-sm font-semibold text-terracotta-strong transition hover:bg-[#f0d9c4]"
            >
              Suggest a category
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterPill href="/discover" selected={!selectedTaxonomyId && !tag}>
              All recipes
            </FilterPill>
            {roots.map((root) => {
              const isRootSelected = selectedTaxonomyId === root.id;
              const isChildOfRootSelected =
                !isRootSelected && childrenOf(root.id).some((ch) => ch.id === selectedTaxonomyId);
              return (
                <FilterPill
                  key={root.id}
                  href={discoverHref({ q, tag, taxonomy: root.id })}
                  selected={isRootSelected}
                  partial={isChildOfRootSelected}
                >
                  {root.label}
                </FilterPill>
              );
            })}
          </div>

          {subPills.length > 0 && expandedParent ? (
            <div className="space-y-2.5 rounded-2xl border border-sand bg-surface/70 px-4 py-3.5 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                Refine <span className="text-terracotta-strong">{expandedParent.label}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  small
                  href={discoverHref({ q, tag, taxonomy: expandedParent.id })}
                  selected={selectedTaxonomyId === expandedParent.id}
                >
                  All in {expandedParent.label}
                </FilterPill>
                {subPills.map((ch) => (
                  <FilterPill
                    key={ch.id}
                    small
                    href={discoverHref({ q, tag, taxonomy: ch.id })}
                    selected={selectedTaxonomyId === ch.id}
                  >
                    {ch.label}
                  </FilterPill>
                ))}
              </div>
            </div>
          ) : null}

          {tag ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <span>
                Filtered by tag <strong className="text-ink">“{tag}”</strong>
              </span>
              <Link
                href={discoverHref({ q, taxonomy: selectedTaxonomyId })}
                className="inline-flex items-center gap-1 rounded-full border border-sand-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
              >
                Clear tag
                <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Results"
          title={resultsTitle}
          aside={<span className="text-sm text-ink-muted">{countLabel}</span>}
        />

        {recipes.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-16 text-center">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-strong">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="5.75" />
                <path d="M13.5 13.5L17 17" strokeLinecap="round" />
              </svg>
            </span>
            <h3 className="mb-2">No recipes found</h3>
            <p className="mx-auto mb-6 max-w-sm text-ink-soft">
              {q || selectedTaxonomyId || tag
                ? "Try clearing filters or searching with different words."
                : "Be the first to create a recipe!"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {q || selectedTaxonomyId || tag ? (
                <Link href="/discover" className="btn btn-secondary">
                  Clear filters
                </Link>
              ) : null}
              <Link href="/create/recipe" className="btn btn-primary">
                Create recipe
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {recipes.map((recipe, i) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                description={recipe.description}
                creatorName={recipe.channelTitle}
                creatorSlug={recipe.channelSlug}
                creatorAvatarUrl={recipe.channelAvatarUrl}
                imageUrl={recipe.coverPublicUrl ?? undefined}
                priority={i < 3}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({
  href,
  selected,
  partial,
  small,
  children,
}: {
  href: string;
  selected?: boolean;
  /** A child of this branch is selected (parent shows a hint state). */
  partial?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  const size = small ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const look = selected
    ? "bg-terracotta text-[#fff8f0] shadow-sm"
    : partial
      ? "border border-terracotta/60 bg-terracotta-tint text-terracotta-strong hover:bg-[#f0d9c4]"
      : "border border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong";
  return (
    <Link href={href} className={`rounded-full font-medium transition ${size} ${look}`}>
      {children}
    </Link>
  );
}
