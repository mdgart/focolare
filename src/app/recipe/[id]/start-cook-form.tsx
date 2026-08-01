"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startCookSessionAction } from "@/actions/cook";
import { formField } from "@/lib/form-styles";
import type { StepInput } from "@/lib/cook-schedule";
import { previewCookSchedule } from "@/lib/cook-schedule";
import { useNowMs } from "@/lib/use-now";

function formatLocalDateTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function StartCookForm(props: {
  recipeId: string;
  stepInputs: StepInput[];
  /** True when some durations were read out of the step wording rather than stated. */
  timingEstimated?: boolean;
}) {
  const router = useRouter();
  const [readyBy, setReadyBy] = useState("");
  const [pending, setPending] = useState(false);
  /**
   * Wall clock for the estimate, ticking every 30s so “finish around …” stays
   * current. It is 0 until mounted, which doubles as the guard that kept a
   * server-time preview from causing an SSR/client mismatch.
   */
  const nowMs = useNowMs(30_000);
  const mounted = nowMs !== 0;

  const invalidReadyBy = Boolean(
    readyBy.trim() && props.stepInputs.length > 0 && Number.isNaN(new Date(readyBy).getTime()),
  );

  /** With no usable durations anywhere, a "schedule" would just repeat the same time back. */
  const hasAnyTiming = props.stepInputs.some((s) => (s.durationSeconds ?? 0) > 0);

  const preview = useMemo(() => {
    if (!mounted) return null;
    if (props.stepInputs.length === 0) return null;
    if (!props.stepInputs.some((s) => (s.durationSeconds ?? 0) > 0)) return null;
    if (readyBy.trim() && Number.isNaN(new Date(readyBy).getTime())) return null;
    return previewCookSchedule(props.stepInputs, {
      nowMs,
      readyByLocal: readyBy || null,
    });
  }, [mounted, nowMs, props.stepInputs, readyBy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const iso = readyBy ? new Date(readyBy).toISOString() : null;
    const res = await startCookSessionAction({ recipeId: props.recipeId, targetReadyAtISO: iso });
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.push(`/cook/${res.cookSessionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-sand bg-surface p-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Cook mode
        </h2>
        <p className="mt-2 font-display text-xl font-semibold text-ink">
          Cook this on your schedule
        </p>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Leave the time empty</strong> — we estimate when
            you&apos;ll be done if you start now.
          </li>
          <li>
            <strong className="text-ink">Pick a &ldquo;ready by&rdquo; time</strong> — we work
            backwards and tell you when to start (if it&apos;s no longer possible, we start from
            now instead).
          </li>
          <li>
            Timer alerts by email or SMS? Set preferences on{" "}
            <Link
              href="/account"
              className="font-semibold text-terracotta underline hover:text-terracotta-strong"
            >
              Account
            </Link>
            .
          </li>
        </ul>
      </div>

      <label className="block text-sm font-medium text-ink-soft">
        Ready by (optional, local time)
        <input
          type="datetime-local"
          value={readyBy}
          onChange={(e) => setReadyBy(e.target.value)}
          className={`mt-1.5 ${formField}`}
        />
      </label>

      {invalidReadyBy ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          That date and time don&apos;t look valid — fix the field to see a schedule preview.
        </p>
      ) : props.stepInputs.length === 0 ? (
        <p className="text-sm text-ink-muted">Add steps with durations to see a ready-time estimate.</p>
      ) : !hasAnyTiming ? (
        <p className="rounded-xl border border-sand-strong bg-sunken px-4 py-3 text-sm leading-relaxed text-ink-soft">
          None of these steps say how long they take, and nothing in the wording implies a time — so
          there is no schedule to work backwards from. You can still cook along step by step, and
          adding durations when you edit the recipe will turn timers on.
        </p>
      ) : !mounted ? (
        <p className="text-sm text-ink-muted" aria-live="polite">
          Calculating schedule from your device clock…
        </p>
      ) : preview ? (
        <div className="space-y-2 rounded-xl bg-terracotta-tint/70 px-4 py-3.5 text-sm text-ink">
          {props.timingEstimated ? (
            <p className="text-xs text-ink-muted">
              Some times are estimated from the step wording, since this recipe doesn&apos;t set them
              explicitly.
            </p>
          ) : null}
          {preview.kind === "start_now" ? (
            <p>
              <span className="font-semibold text-terracotta-strong">If you start now:</span>{" "}
              estimated done around{" "}
              <time
                className="font-semibold tabular-nums text-terracotta-strong"
                dateTime={new Date(preview.readyAtMs).toISOString()}
              >
                {formatLocalDateTime(preview.readyAtMs)}
              </time>
              .
            </p>
          ) : preview.kind === "target_ok" ? (
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-terracotta-strong">Your target:</span> be ready
                by{" "}
                <time
                  className="font-semibold tabular-nums text-terracotta-strong"
                  dateTime={new Date(preview.targetReadyMs).toISOString()}
                >
                  {formatLocalDateTime(preview.targetReadyMs)}
                </time>
                .
              </p>
              <p>
                <span className="font-semibold text-terracotta-strong">To hit that:</span> start
                step 1 around{" "}
                <time
                  className="font-semibold tabular-nums text-terracotta-strong"
                  dateTime={new Date(preview.plannedStartMs).toISOString()}
                >
                  {formatLocalDateTime(preview.plannedStartMs)}
                </time>{" "}
                — then you should finish around{" "}
                <time
                  className="font-semibold tabular-nums text-terracotta-strong"
                  dateTime={new Date(preview.readyAtMs).toISOString()}
                >
                  {formatLocalDateTime(preview.readyAtMs)}
                </time>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-terracotta-strong">
                  That &ldquo;ready by&rdquo; time is too soon
                </span>{" "}
                for the total time in this recipe — you would have needed to start around{" "}
                <time
                  className="font-semibold tabular-nums text-terracotta-strong"
                  dateTime={new Date(preview.plannedStartMs).toISOString()}
                >
                  {formatLocalDateTime(preview.plannedStartMs)}
                </time>
                .
              </p>
              <p>
                <span className="font-semibold text-terracotta-strong">
                  If you start now instead:
                </span>{" "}
                estimated done around{" "}
                <time
                  className="font-semibold tabular-nums text-terracotta-strong"
                  dateTime={new Date(preview.readyAtMs).toISOString()}
                >
                  {formatLocalDateTime(preview.readyAtMs)}
                </time>
                .
              </p>
            </div>
          )}
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-50">
        {pending ? "Starting…" : "Start cooking"}
      </button>
    </form>
  );
}
