"use client";

import { useEffect, useMemo, useState } from "react";
import { completeCookSessionAction } from "@/actions/cook";

type TimelineJson = {
  title: string;
  startMs: number;
  endMs: number;
  durationSeconds: number;
};

export function CookSessionClient(props: {
  cookSessionId: string;
  recipeTitle: string;
  timeline: TimelineJson[];
}) {
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const step = props.timeline[idx];

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (!step) return 0;
    return Math.max(0, step.endMs - now);
  }, [step, now]);

  async function onDone() {
    await completeCookSessionAction(props.cookSessionId);
    window.location.href = "/";
  }

  if (!step) {
    return (
      <div className="rounded-xl border border-neutral-800 p-6 text-center text-neutral-400">
        No steps in this session.
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Step {idx + 1} / {props.timeline.length}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-amber-50">{step.title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{props.recipeTitle}</p>
      </div>
      <div className="my-8 text-center">
        {step.durationSeconds > 0 ? (
          <>
            <div className="text-5xl font-mono tabular-nums text-amber-200">
              {Math.floor(remainingMs / 60000)
                .toString()
                .padStart(2, "0")}
              :
              {Math.floor((remainingMs % 60000) / 1000)
                .toString()
                .padStart(2, "0")}
            </div>
            <p className="mt-2 text-xs text-neutral-500">Time left on this step</p>
          </>
        ) : (
          <p className="text-neutral-400">No timer for this step.</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {idx < props.timeline.length - 1 ? (
          <button
            type="button"
            className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-medium text-neutral-100 hover:bg-neutral-700"
            onClick={() => setIdx((i) => i + 1)}
          >
            Next step
          </button>
        ) : (
          <button
            type="button"
            className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
            onClick={() => void onDone()}
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
