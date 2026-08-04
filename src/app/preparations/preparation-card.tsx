"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completePreparationAction } from "@/actions/preparations";
import { useNowMs } from "@/lib/use-now";
import type { OngoingPreparation } from "@/actions/preparations";
import { formatDurationClock } from "@/lib/format-duration";

function coerceDate(d: Date | string | null | undefined): Date | null {
  if (d == null) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWhen(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLine(item: OngoingPreparation, nowMs: number): string {
  const timerEndsAt = coerceDate(item.timerEndsAt);
  const startedAt = coerceDate(item.startedAt);

  if (timerEndsAt) {
    // nowMs is 0 until the clock subscribes; show the end time without a countdown.
    if (nowMs === 0) return `Timer · ends ${formatWhen(timerEndsAt)}`;
    const leftSec = Math.max(0, Math.ceil((timerEndsAt.getTime() - nowMs) / 1000));
    if (leftSec > 0) {
      return `Timer · ${formatDurationClock(leftSec)} left · ends ${formatWhen(timerEndsAt)}`;
    }
    return `Timer finished · ready since ${formatWhen(timerEndsAt)}`;
  }
  if (item.stepDurationSeconds > 0) {
    return "Waiting — start the timer when you begin this step";
  }
  if (startedAt) {
    return `Started ${formatWhen(startedAt)}`;
  }
  return "In progress";
}

export function PreparationCard({ item }: { item: OngoingPreparation }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Ticks every second so the countdown actually counts down; 0 until mounted.
  const nowMs = useNowMs(1_000);

  async function onComplete() {
    if (!window.confirm(`Mark "${item.recipeTitle}" as completed and remove it from your list?`)) return;
    setPending(true);
    const res = await completePreparationAction(item.cookSessionId);
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm ring-1 ring-stone-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.categoryLabel ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                {item.categoryLabel}
              </span>
            ) : null}
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Step {item.currentStepIndex + 1} of {item.stepCount}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-stone-900">
            <Link href={item.recipePath} className="hover:text-amber-900 hover:underline">
              {item.recipeTitle}
            </Link>
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">{item.currentStepTitle}</p>
          <p className="mt-2 text-sm text-stone-600">{statusLine(item, nowMs)}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-40">
          <Link
            href={`/cook/${item.cookSessionId}`}
            className="rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-stone-950 shadow-sm ring-1 ring-amber-800/20 hover:from-amber-400 hover:to-amber-500"
          >
            Continue
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onComplete()}
            className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            {pending ? "Removing…" : "Completed"}
          </button>
        </div>
      </div>
    </article>
  );
}
