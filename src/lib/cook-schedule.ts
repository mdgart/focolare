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
      title: s.title,
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
