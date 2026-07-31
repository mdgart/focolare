"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approveTaxonomySuggestionAction } from "@/actions/admin";

export function ApproveTaxonomySuggestionButton({ suggestionId }: { suggestionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await approveTaxonomySuggestionAction(suggestionId);
          if ("error" in res) {
            window.alert(res.error);
            return;
          }
          router.refresh();
        });
      }}
      className="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Approving…" : "Approve"}
    </button>
  );
}
