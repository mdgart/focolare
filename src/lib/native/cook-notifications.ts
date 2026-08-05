import type { ArmedTimer } from "@/lib/cook-timers";
import type { DesiredNotification } from "@/lib/native/local-schedule";

/**
 * Turning running timers into alarms the OS should hold.
 *
 * Pure, and separate from the effect that calls it, because the interesting
 * cases are all edge cases: a paused timer, a step with no duration, a timer
 * that finished while the phone was in a pocket. Those are worth checks, and
 * checks are cheap only if no phone is involved.
 */

export type TimelineStep = { durationSeconds?: number; label?: string; text?: string };

/** Stable across reloads, and matching what the server would call it. */
export function cookTimerKey(cookSessionId: string, stepIndex: number): string {
  return `${cookSessionId}:step:${stepIndex}`;
}

/**
 * The alarms a cook session currently wants.
 *
 * **Paused timers are deliberately excluded.** A paused countdown has no fire
 * time — it resumes whenever the cook comes back — and scheduling one for its
 * would-be deadline is how you get an alarm during a break someone took
 * precisely to avoid being interrupted. Resuming re-runs this and puts it back.
 */
export function desiredCookNotifications(
  cookSessionId: string,
  recipeTitle: string,
  timeline: readonly TimelineStep[],
  armed: readonly ArmedTimer[],
  now: number,
): DesiredNotification[] {
  const out: DesiredNotification[] = [];

  for (const timer of armed) {
    if (timer.state !== "running") continue;

    const step = timeline[timer.stepIndex];
    const duration = step?.durationSeconds ?? 0;
    if (duration <= 0) continue;

    const fireAt = timer.atMs + duration * 1000;
    // Already elapsed: the in-page alarm has this, and a past-dated OS alarm
    // can fire immediately on Android.
    if (fireAt <= now) continue;

    const label = step?.label?.trim() || step?.text?.trim() || `Step ${timer.stepIndex + 1}`;
    out.push({
      key: cookTimerKey(cookSessionId, timer.stepIndex),
      title: `${recipeTitle} — timer done`,
      // The step, not "your timer finished": a cook glancing at a lock screen
      // needs to know what to go and do.
      body: label.length > 120 ? `${label.slice(0, 117)}…` : label,
      fireAt,
      kind: "cook_timer",
      url: `/cook/${cookSessionId}`,
    });
  }

  return out;
}
