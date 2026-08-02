/**
 * The rules about when a cook timer starts, pauses, survives, and stops.
 *
 * Pulled out of the cook screen so they can be tested, because "the timer
 * stopped and I don't know why" is the worst failure this app has: it's silent,
 * it's discovered late, and by then the food is wrong.
 *
 * Two governing rules, and everything here exists to make them checkable:
 *
 * 1. **A timer belongs to a step, and only that step's own progress ends it.**
 *    Looking at another step — back, forward, or from the all-steps list —
 *    never touches a running timer.
 * 2. **Nothing stops a timer silently.** Arming, pausing and retiring are the
 *    only operations that change a countdown, and each is something a cook
 *    asked for.
 */

export type ArmedTimer =
  | {
      stepIndex: number;
      state: "running";
      /** When the countdown started, in epoch ms. */
      atMs: number;
    }
  | {
      stepIndex: number;
      state: "paused";
      /** What was left at the moment it was paused. */
      remainingMs: number;
    };

/**
 * Rebuild the timers from what the server has scheduled.
 *
 * A running timer's start is derived by subtracting the step's duration from
 * when its push is due, since that's the only record of it. A paused one keeps
 * its remaining time explicitly, because a paused timer has no due time — that
 * is the whole point of pausing.
 *
 * Events whose step has no duration, or which aren't attached to a step, are
 * dropped: there'd be no countdown to draw.
 */
export function armedFromPending(
  pending: readonly {
    stepIndex: number | null;
    fireAtMs: number;
    pausedRemainingSeconds?: number | null;
  }[],
  stepDurationsSeconds: readonly (number | null | undefined)[],
): ArmedTimer[] {
  return pending.flatMap((event): ArmedTimer[] => {
    if (event.stepIndex == null) return [];
    const duration = stepDurationsSeconds[event.stepIndex] ?? 0;
    if (duration <= 0) return [];

    if (event.pausedRemainingSeconds != null) {
      return [
        {
          stepIndex: event.stepIndex,
          state: "paused" as const,
          remainingMs: Math.max(0, event.pausedRemainingSeconds) * 1000,
        },
      ];
    }
    return [
      {
        stepIndex: event.stepIndex,
        state: "running" as const,
        atMs: event.fireAtMs - duration * 1000,
      },
    ];
  });
}

/**
 * Start (or restart) the timer on one step, leaving every other one alone.
 *
 * Re-arming the same step deliberately replaces its entry, because the server
 * does the same: arming deletes that step's existing event and writes a fresh
 * one. This is the only operation that sends a countdown back to full, and it
 * only happens when someone presses the button for that step.
 */
export function armStep(
  armed: readonly ArmedTimer[],
  stepIndex: number,
  nowMs: number,
): ArmedTimer[] {
  return [...armed.filter((t) => t.stepIndex !== stepIndex), { stepIndex, state: "running", atMs: nowMs }];
}

/** Hold a running timer where it is. A paused timer is left as it was. */
export function pauseStep(
  armed: readonly ArmedTimer[],
  stepIndex: number,
  durationSeconds: number,
  nowMs: number,
): ArmedTimer[] {
  return armed.map((timer) => {
    if (timer.stepIndex !== stepIndex || timer.state !== "running") return timer;
    return {
      stepIndex,
      state: "paused",
      remainingMs: remainingMs(armed, stepIndex, durationSeconds, nowMs),
    };
  });
}

/**
 * Pick a paused timer back up where it left off.
 *
 * The start time is backdated by however much had already elapsed, so the
 * remaining time carries over exactly — resuming is not restarting.
 */
export function resumeStep(
  armed: readonly ArmedTimer[],
  stepIndex: number,
  durationSeconds: number,
  nowMs: number,
): ArmedTimer[] {
  const durationMs = Math.max(0, durationSeconds) * 1000;
  return armed.map((timer) => {
    if (timer.stepIndex !== stepIndex || timer.state !== "paused") return timer;
    const elapsed = durationMs - Math.min(timer.remainingMs, durationMs);
    return { stepIndex, state: "running", atMs: nowMs - elapsed };
  });
}

/** Finishing a step ends its timer — and nothing else's. */
export function retireStep(armed: readonly ArmedTimer[], stepIndex: number): ArmedTimer[] {
  return armed.filter((t) => t.stepIndex !== stepIndex);
}

/** The timer on a given step, or null. Reading never changes anything. */
export function timerFor(armed: readonly ArmedTimer[], stepIndex: number): ArmedTimer | null {
  return armed.find((t) => t.stepIndex === stepIndex) ?? null;
}

/**
 * Milliseconds left on a step, floored at zero.
 *
 * With no timer at all this is the step's full duration — the screen shows what
 * you're about to start, not a blank. A paused timer holds its number steady
 * however long the break lasts.
 */
export function remainingMs(
  armed: readonly ArmedTimer[],
  stepIndex: number,
  durationSeconds: number,
  nowMs: number,
): number {
  const durationMs = Math.max(0, durationSeconds) * 1000;
  const timer = timerFor(armed, stepIndex);
  if (!timer) return durationMs;
  if (timer.state === "paused") return Math.max(0, Math.min(timer.remainingMs, durationMs));
  return Math.max(0, durationMs - (nowMs - timer.atMs));
}

/**
 * Would moving on from this step throw away a timer?
 *
 * Used to ask first. Only the step being left matters: a timer on another step
 * isn't affected by finishing this one, and warning about it would train people
 * to dismiss the warning. A paused timer counts — it's still something the cook
 * set up and expects to come back to.
 */
export function advanceWouldStopTimer(armed: readonly ArmedTimer[], stepIndex: number): boolean {
  return timerFor(armed, stepIndex) !== null;
}
