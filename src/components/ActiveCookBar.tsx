"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ActiveCook } from "@/actions/cook";
import { formatDurationClock } from "@/lib/format-duration";

/**
 * A standing reminder that something is on the hob.
 *
 * Sits in the sticky header rather than being a dismissible toast, because the
 * thing it points at has timers running: a banner you can wave away is a banner
 * that isn't there when the food needs you. It replaces `ActiveCookToast`, which
 * was dismissible, styled from before the redesign, and — the reason none of
 * this was visible — never actually rendered anywhere.
 *
 * The account menu's "In progress" only ever counted ferments and cures, so an
 * ordinary dinner mid-cook had no representation in the UI at all.
 */
export function ActiveCookBar({ cook }: { cook: ActiveCook }) {
  const pathname = usePathname();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (cook.timerFireAtMs == null) return;
    // Starts null and is set on the client, so the server and first client
    // render agree — a clock rendered on the server is a hydration mismatch
    // waiting to happen.
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cook.timerFireAtMs]);

  // No point telling someone they're cooking while they're on the cook screen.
  if (pathname.startsWith(`/cook/`)) return null;

  const remainingMs = cook.timerFireAtMs != null && now != null ? cook.timerFireAtMs - now : null;

  return (
    <div className="border-t border-sand/70 py-2">
      <Link
        href={`/cook/${cook.cookSessionId}`}
        className="group flex items-center gap-3 rounded-full border border-terracotta/40 bg-terracotta-tint/60 px-3 py-1.5 transition hover:border-terracotta hover:bg-terracotta-tint"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-terracotta" />
        </span>

        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-ink">Cooking now</span>
          <span className="text-ink-soft"> — </span>
          <span className="truncate text-ink-soft">{cook.recipeTitle}</span>
          {cook.stepCount > 0 ? (
            <span className="hidden text-ink-muted sm:inline">
              {" "}
              · Step {cook.stepIndex + 1} of {cook.stepCount}
            </span>
          ) : null}
        </span>

        {remainingMs != null && remainingMs > 0 ? (
          <span className="shrink-0 font-mono text-sm tabular-nums text-terracotta-strong">
            {formatDurationClock(Math.ceil(remainingMs / 1000))}
          </span>
        ) : null}
        {remainingMs != null && remainingMs <= 0 ? (
          <span className="shrink-0 text-sm font-semibold text-terracotta-strong">Timer done</span>
        ) : null}
        {cook.timerPaused ? (
          <span className="shrink-0 text-xs font-medium text-ink-muted">Paused</span>
        ) : null}

        <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-terracotta-strong">
          Resume →
        </span>
      </Link>
    </div>
  );
}
