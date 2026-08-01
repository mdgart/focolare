/**
 * Estimate how long a step takes from the words a cook wrote.
 *
 * Plenty of recipes describe timing in prose — "bake for 40 minutes", "rest
 * overnight" — without anyone filling in the duration fields. Left alone, the
 * scheduler treats those steps as instantaneous and cheerfully claims a loaf
 * starting at 12:30 will be ready at 12:30.
 *
 * Deliberately a parser and not an AI call: this runs on every render of the
 * cook planner, so it has to be instant, free, and give the same answer twice.
 * It reads only explicit time expressions and returns null when unsure — a
 * missing estimate is honest, a fabricated one is not.
 */

const UNIT_SECONDS: Record<string, number> = {
  second: 1,
  sec: 1,
  s: 1,
  minute: 60,
  min: 60,
  m: 60,
  hour: 3600,
  hr: 3600,
  h: 3600,
  day: 86400,
  d: 86400,
  week: 604800,
};

/** Phrases with a conventional meaning in recipes. */
const PHRASES: { pattern: RegExp; seconds: number }[] = [
  { pattern: /\bovernight\b/i, seconds: 8 * 3600 },
  { pattern: /\ball[- ]night\b/i, seconds: 8 * 3600 },
  { pattern: /\ball[- ]day\b/i, seconds: 8 * 3600 },
  { pattern: /\ba few days\b/i, seconds: 3 * 86400 },
  { pattern: /\ba couple of days\b/i, seconds: 2 * 86400 },
  { pattern: /\ba few hours\b/i, seconds: 3 * 3600 },
  { pattern: /\ba couple of hours\b/i, seconds: 2 * 3600 },
  { pattern: /\bhalf an hour\b/i, seconds: 1800 },
  { pattern: /\bquarter of an hour\b/i, seconds: 900 },
  // Must not fire inside "half an hour" / "quarter of an hour", which mean less
  // than an hour — the longest-wins rule would otherwise round them up.
  { pattern: /(?<!half\s)(?<!quarter of\s)\ban hour\b/i, seconds: 3600 },
  { pattern: /\ba few minutes\b/i, seconds: 3 * 60 },
  { pattern: /\ba couple of minutes\b/i, seconds: 2 * 60 },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

/**
 * `2`, `2.5`, `1½`, `1 1/2`, `20-25` (a range takes the upper bound, since
 * under-running a timer is worse than over-running one).
 */
function parseAmount(raw: string): number | null {
  const text = raw.trim().toLowerCase();

  const word = NUMBER_WORDS[text];
  if (word) return word;

  // Range: keep the longer end.
  const range = text.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)$/);
  if (range) return Number(range[2]);

  // Mixed fraction: "1 1/2"
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  // Vulgar fractions, alone or trailing a whole number.
  const vulgar: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  const withVulgar = text.match(/^(\d*)\s*([½¼¾⅓⅔])$/);
  if (withVulgar) return (Number(withVulgar[1]) || 0) + vulgar[withVulgar[2]!]!;

  const plain = text.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return Number(plain[1]);

  return null;
}

const DURATION_RE = new RegExp(
  String.raw`(\d+(?:\.\d+)?(?:\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?)?|\d*\s*[½¼¾⅓⅔]|\d+\s+\d+\/\d+|` +
    Object.keys(NUMBER_WORDS).join("|") +
    String.raw`)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|[smhd])\b`,
  "gi",
);

/**
 * Longest explicit duration in the text, in seconds, or null when there is none.
 *
 * The longest is the useful one: "knead 5 minutes, then rest 1 hour" is an hour
 * of elapsed time, not five minutes.
 */
export function inferDurationSecondsFromText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;

  let best = 0;

  for (const { pattern, seconds } of PHRASES) {
    if (pattern.test(text)) best = Math.max(best, seconds);
  }

  for (const match of text.matchAll(DURATION_RE)) {
    const amount = parseAmount(match[1] ?? "");
    if (amount == null) continue;
    const unit = (match[2] ?? "").toLowerCase().replace(/s$/, "");
    const perUnit = UNIT_SECONDS[unit];
    if (!perUnit) continue;
    // A bare "m"/"h" after a number is common; a bare "s" is usually a plural, not seconds.
    best = Math.max(best, Math.round(amount * perUnit));
  }

  return best > 0 ? best : null;
}

export type StepLike = {
  durationSeconds: number | null;
  title?: string | null;
  instruction?: string | null;
};

/** A step's duration, falling back to whatever its wording implies. */
export function effectiveStepSeconds(step: StepLike): { seconds: number; estimated: boolean } {
  if (step.durationSeconds && step.durationSeconds > 0) {
    return { seconds: step.durationSeconds, estimated: false };
  }
  const inferred = inferDurationSecondsFromText(
    [step.title, step.instruction].filter(Boolean).join(". "),
  );
  return inferred ? { seconds: inferred, estimated: true } : { seconds: 0, estimated: false };
}

/** Total time for a recipe, and whether any of it was inferred rather than stated. */
export function totalRecipeSeconds(steps: StepLike[]): { seconds: number; estimated: boolean } {
  let total = 0;
  let estimated = false;
  for (const step of steps) {
    const r = effectiveStepSeconds(step);
    total += r.seconds;
    if (r.estimated && r.seconds > 0) estimated = true;
  }
  return { seconds: total, estimated };
}
