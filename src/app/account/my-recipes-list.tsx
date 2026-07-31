"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { UserRecipeRow } from "@/actions/recipes";
import { DeleteRecipeButton } from "@/app/recipe/[id]/delete-recipe-button";

type Filter = "all" | "published" | "private" | "drafts";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "private", label: "Private" },
  { key: "drafts", label: "Drafts" },
];

function matches(r: UserRecipeRow, f: Filter): boolean {
  const isDraft = r.publishedAt === null;
  if (f === "all") return true;
  if (f === "drafts") return isDraft;
  if (f === "private") return !isDraft && r.visibility === "private";
  return !isDraft && r.visibility === "public";
}

export function MyRecipesList({ recipes }: { recipes: UserRecipeRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.key, recipes.filter((r) => matches(r, f.key)).length]),
      ) as Record<Filter, number>,
    [recipes],
  );
  const shown = useMemo(() => recipes.filter((r) => matches(r, filter)), [recipes, filter]);

  if (recipes.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center">
        <p className="text-sm text-neutral-600">You haven&apos;t created any recipes yet.</p>
        <Link href="/create/recipe" className="btn btn-primary mt-4 inline-block text-sm">
          Create a recipe
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.key
                ? "border-transparent bg-terracotta text-[#fff8f0]"
                : "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70 tabular-nums">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand-strong bg-surface/60 px-4 py-8 text-center text-sm text-ink-muted">
          {filter === "private"
            ? "No private recipes yet. Set a recipe's visibility to Private to keep it to yourself."
            : filter === "drafts"
              ? "No drafts — everything you've started is published."
              : "Nothing here yet."}
        </p>
      ) : (
    <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
      {shown.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
          <Link href={`/recipe/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 group">
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {r.coverPublicUrl ? (
                <Image
                  src={r.coverPublicUrl}
                  alt=""
                  fill
                  unoptimized={r.coverPublicUrl.includes("/api/files")}
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-400">No photo</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900 group-hover:text-amber-900">{r.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                {r.publishedAt === null ? (
                  <span className="rounded-full border border-terracotta/50 bg-terracotta-tint px-2 py-0.5 font-semibold uppercase tracking-wide text-terracotta-strong">
                    Draft
                  </span>
                ) : null}
                {r.moderationStatus !== "approved" ? (
                  <span className="rounded-full border border-sand-strong bg-sunken px-2 py-0.5 font-semibold uppercase tracking-wide text-ink-soft">
                    In review
                  </span>
                ) : null}
                <span>
                  {r.publishedAt === null
                    ? "Not published"
                    : r.visibility === "private"
                      ? "Private"
                      : "Public"}{" "}
                  · Updated{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(r.updatedAt)}
                </span>
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href={`/recipe/${r.id}/edit`}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Edit
            </Link>
            <DeleteRecipeButton recipeId={r.id} redirectTo="/account" />
          </div>
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}
