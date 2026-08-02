"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMealPlanAction } from "@/actions/meal-plans";

/**
 * Deleting a plan takes its meals, shopping list and reminders with it, so the
 * confirm step names the plan rather than asking a generic "are you sure?".
 */
export function DeletePlanButton({ planId, planTitle }: { planId: string; planTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteMealPlanAction(planId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/plan");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-200 bg-surface px-4 py-2 text-sm font-medium text-red-800 transition hover:border-red-400 hover:bg-red-50"
      >
        Delete plan
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
      <span className="text-sm font-medium text-red-950">
        Delete “{planTitle}”, its meals and its shopping list?
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={confirmDelete}
        className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen(false)}
        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Cancel
      </button>
      {error ? <span className="w-full text-xs font-medium text-red-800">{error}</span> : null}
    </div>
  );
}
