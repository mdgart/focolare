/**
 * Linear cook timeline + reverse "ready by" scheduling.
 * @see docs/cook-mode.md
 */

export type StepInput = {
  position: number;
  title: string;
  durationSeconds: number | null;
  offsetFromPrevious: number;
};

export type StepInstant = {
  index: number;
  title: string;
  /** wall-clock start */
  startMs: number;
  /** wall-clock end (start if no duration) */
  endMs: number;
  durationSeconds: number;
};

function stepDurationSeconds(s: StepInput): number {
  return s.durationSeconds ?? 0;
}

/** Forward timeline from absolute start `t0` (ms). */
export function buildForwardTimeline(steps: StepInput[], t0Ms: number): StepInstant[] {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const out: StepInstant[] = [];
  let cursor = t0Ms;
  ordered.forEach((s, index) => {
    if (index > 0) {
      cursor += s.offsetFromPrevious * 1000;
    }
    const dur = stepDurationSeconds(s);
    const startMs = cursor;
    const endMs = startMs + dur * 1000;
    out.push({
      index,
      title: s.title.trim() || `Step ${index + 1}`,
      startMs,
      endMs,
      durationSeconds: dur,
    });
    cursor = endMs;
  });
  return out;
}

/** Total elapsed seconds from start of step 0 through end of last step. */
export function totalDurationSeconds(steps: StepInput[]): number {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return 0;
  let total = stepDurationSeconds(ordered[0]!);
  for (let i = 1; i < ordered.length; i++) {
    const s = ordered[i]!;
    total += s.offsetFromPrevious + stepDurationSeconds(s);
  }
  return total;
}

/** Latest instant you can start step 0 and still finish by `targetEndMs`. */
export function plannedStartFromReadyBy(steps: StepInput[], targetEndMs: number): number {
  const totalMs = totalDurationSeconds(steps) * 1000;
  return targetEndMs - totalMs;
}

/** When step 0 starts at `startStep0Ms`, wall-clock ms when the last step ends. */
export function readyAtMsFromStart(stepInputs: StepInput[], startStep0Ms: number): number {
  const timeline = buildForwardTimeline(stepInputs, startStep0Ms);
  if (timeline.length === 0) return startStep0Ms;
  return timeline[timeline.length - 1]!.endMs;
}

export type CookSchedulePreview =
  | { kind: "start_now"; startAtMs: number; readyAtMs: number }
  | {
      kind: "target_ok";
      plannedStartMs: number;
      startAtMs: number;
      targetReadyMs: number;
      readyAtMs: number;
    }
  | {
      kind: "target_late";
      plannedStartMs: number;
      startAtMs: number;
      targetReadyMs: number;
      readyAtMs: number;
    };

/** Preview finish time for UI: from "now", or from a datetime-local "ready by" value. */
export function previewCookSchedule(
  stepInputs: StepInput[],
  opts: { nowMs: number; readyByLocal?: string | null },
): CookSchedulePreview | null {
  if (stepInputs.length === 0) return null;
  const nowMs = opts.nowMs;
  const raw = opts.readyByLocal?.trim();
  if (!raw) {
    const startAtMs = nowMs;
    const readyAtMs = readyAtMsFromStart(stepInputs, startAtMs);
    return { kind: "start_now", startAtMs, readyAtMs };
  }
  const targetReadyMs = new Date(raw).getTime();
  if (Number.isNaN(targetReadyMs)) return null;
  const plannedStartMs = plannedStartFromReadyBy(stepInputs, targetReadyMs);
  const startAtMs = Math.max(nowMs, plannedStartMs);
  const readyAtMs = readyAtMsFromStart(stepInputs, startAtMs);
  if (plannedStartMs < nowMs) {
    return { kind: "target_late", plannedStartMs, startAtMs, targetReadyMs, readyAtMs };
  }
  return { kind: "target_ok", plannedStartMs, startAtMs, targetReadyMs, readyAtMs };
}
