"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveFlaggedRecipeAction, rejectFlaggedRecipeAction } from "@/actions/moderation";

export function ReviewButtons({ recipeId, status }: { recipeId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: (id: string) => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn(recipeId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "approved" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(approveFlaggedRecipeAction)}
            className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-[#fff8f0] transition hover:brightness-95 disabled:opacity-60"
          >
            {isPending ? "Working…" : "Publish anyway"}
          </button>
        ) : null}
        {status !== "rejected" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(rejectFlaggedRecipeAction)}
            className="rounded-full border border-red-200 bg-surface px-4 py-2 text-sm font-medium text-red-800 transition hover:border-red-400 hover:bg-red-50 disabled:opacity-60"
          >
            Keep hidden
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
