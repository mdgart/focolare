"use client";

import Link from "next/link";
import { setLocalStorageValue, useLocalStorageValue } from "@/lib/use-local-storage-value";

const STORAGE_KEY = "focolare.dismissCookSessionBanner";

export function ActiveCookToast({ sessionId }: { sessionId: string }) {
  const dismissedSession = useLocalStorageValue(STORAGE_KEY);

  function dismiss() {
    setLocalStorageValue(STORAGE_KEY, sessionId);
  }

  // `undefined` means we haven't read storage yet — stay hidden rather than
  // flashing a banner the user already dismissed.
  if (dismissedSession === undefined || dismissedSession === sessionId) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-[min(100vw-2rem,20rem)] rounded-xl border border-neutral-200/90 bg-white/95 px-4 py-3 pr-10 text-neutral-800 shadow-lg backdrop-blur-sm"
      role="status"
    >
      <button
        type="button"
        aria-label="Dismiss cooking reminder"
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
      >
        ×
      </button>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">In progress</p>
      <p className="mt-0.5 text-sm font-semibold text-neutral-900">Cook session active</p>
      <p className="mt-1 text-xs leading-snug text-neutral-600">Timers and steps are waiting on the cook screen.</p>
      <Link
        href={`/cook/${sessionId}`}
        className="mt-3 inline-flex rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-sm ring-1 ring-amber-800/20 hover:from-amber-400 hover:to-amber-500"
      >
        Continue →
      </Link>
    </div>
  );
}
