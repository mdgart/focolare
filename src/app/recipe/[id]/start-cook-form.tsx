"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startCookSessionAction } from "@/actions/cook";

export function StartCookForm({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [readyBy, setReadyBy] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const iso = readyBy ? new Date(readyBy).toISOString() : null;
    const res = await startCookSessionAction({ recipeId, targetReadyAtISO: iso });
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.push(`/cook/${res.cookSessionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Cook mode</h2>
      <label className="block text-sm text-neutral-400">
        Ready by (optional, local time)
        <input
          type="datetime-local"
          value={readyBy}
          onChange={(e) => setReadyBy(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start cooking"}
      </button>
    </form>
  );
}
