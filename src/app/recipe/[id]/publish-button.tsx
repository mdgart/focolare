"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRecipePublishedAction } from "@/actions/recipes";

export function PublishRecipeButton({
  recipeId,
  published,
}: {
  recipeId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setRecipePublishedAction(recipeId, !published);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end print:hidden">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={
          published
            ? "rounded-full border border-sand-strong bg-surface px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-60"
            : "rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-[#fff8f0] transition hover:bg-terracotta-strong disabled:opacity-60"
        }
      >
        {isPending ? "Working…" : published ? "Unpublish" : "Publish"}
      </button>
      {error ? <span className="mt-1 text-xs font-medium text-red-700">{error}</span> : null}
    </span>
  );
}
