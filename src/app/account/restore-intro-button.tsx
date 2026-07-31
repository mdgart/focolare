"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreHomeIntroAction } from "@/actions/account";

const GUEST_STORAGE_KEY = "focolare.dismissHomeIntro";

export function RestoreIntroButton({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function restore() {
    setError(null);
    // Clear the guest key too, in case this browser dismissed it before signing in.
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      const res = await restoreHomeIntroAction();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (!hidden && !done) {
    return <p className="text-sm text-ink-muted">The welcome panel is showing on the home page.</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={restore}
        disabled={isPending || done}
        className="btn btn-secondary !py-2 text-sm disabled:opacity-60"
      >
        {isPending ? "Restoring…" : done ? "Restored — visit the home page" : "Show it again"}
      </button>
      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
