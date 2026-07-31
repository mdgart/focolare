/** Root taxonomy slugs that always track as multi-day preparations. */
export const PREPARATION_ROOT_SLUGS = new Set(["fermenting", "curing", "preserving"]);

/** Long ferment / proof steps on bread and similar bakes. */
export const LONG_STEP_SECONDS = 8 * 3600;

/** Any step this long qualifies regardless of category. */
export const VERY_LONG_STEP_SECONDS = 24 * 3600;

export type StepTiming = {
  durationSeconds: number | null;
  offsetFromPrevious: number;
};

export function maxStepSeconds(steps: StepTiming[]): number {
  let max = 0;
  for (const s of steps) {
    if (s.durationSeconds != null && s.durationSeconds > max) max = s.durationSeconds;
    if (s.offsetFromPrevious > max) max = s.offsetFromPrevious;
  }
  return max;
}

/** True when an active cook session should appear on the preparations page. */
export function isPreparationRecipe(opts: {
  taxonomySlug: string | null;
  taxonomySlugs: string[];
  steps: StepTiming[];
}): boolean {
  const slugs = new Set(
    [opts.taxonomySlug, ...opts.taxonomySlugs].filter((s): s is string => Boolean(s)),
  );

  for (const root of PREPARATION_ROOT_SLUGS) {
    if (slugs.has(root)) return true;
  }

  const maxSec = maxStepSeconds(opts.steps);
  if (maxSec >= VERY_LONG_STEP_SECONDS) return true;

  if (maxSec >= LONG_STEP_SECONDS && (slugs.has("baking") || slugs.has("baking-bread"))) {
    return true;
  }

  return false;
}
