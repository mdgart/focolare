"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleSaveRecipeAction } from "@/actions/saved";

/** Bookmark toggle. Guests get a sign-in link instead, so the control is never a dead end. */
export function SaveRecipeButton({
  recipeId,
  initialSaved,
  isLoggedIn,
  signInHref,
}: {
  recipeId: string;
  initialSaved: boolean;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link
        href={signInHref}
        className="inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-surface px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong print:hidden"
      >
        <BookmarkIcon filled={false} />
        Save
      </Link>
    );
  }

  function toggle() {
    setError(null);
    // Optimistic: the toggle is cheap and reversible, so reflect it immediately.
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleSaveRecipeAction(recipeId);
      if ("error" in res) {
        setSaved(!next);
        setError(res.error);
        return;
      }
      setSaved(res.saved);
    });
  }

  return (
    <span className="inline-flex flex-col items-start print:hidden">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={saved}
        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-70 ${
          saved
            ? "border-terracotta/50 bg-terracotta-tint text-terracotta-strong hover:bg-[#f0d9c4]"
            : "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
        }`}
      >
        <BookmarkIcon filled={saved} />
        {saved ? "Saved" : "Save"}
      </button>
      {error ? <span className="mt-1 text-xs font-medium text-red-700">{error}</span> : null}
    </span>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5.5 3.5h9a1 1 0 0 1 1 1v12l-5.5-3.2L4.5 16.5v-12a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    </svg>
  );
}
