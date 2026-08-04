"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRecipeAction } from "@/actions/recipes";

export function DeleteRecipeButton(props: { recipeId: string; redirectTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    const res = await deleteRecipeAction(props.recipeId);
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.push(props.redirectTo ?? `/c/${res.channelSlug}`);
    router.refresh();
  }

  return (
    <div className="relative print:hidden">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-red-200 bg-surface px-4 py-1.5 text-sm font-medium text-red-800 transition hover:border-red-400 hover:bg-red-50"
        >
          Delete recipe
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-sm font-medium text-red-950">Delete permanently?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => void confirmDelete()}
            className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
