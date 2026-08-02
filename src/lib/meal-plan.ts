/**
 * Dates and meal shapes for the planner.
 *
 * Plan dates are `'YYYY-MM-DD'` strings everywhere — in the database, in props,
 * in URLs. They are never turned into a `Date` for display or arithmetic,
 * because `new Date('2026-08-01')` parses as midnight **UTC**, which is the
 * previous day for anyone west of Greenwich. Only reminder scheduling converts
 * to an instant, and that goes through `zonedWallTimeToUtc`.
 */

export type MealType = "breakfast" | "lunch" | "dinner";

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** Used when a slot has no explicit meal time. Wall clock in the plan's zone. */
export const DEFAULT_MEAL_TIMES: Record<MealType, string> = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "19:00",
};

/** A month is as far ahead as anyone plans groceries for. */
export const MAX_PLAN_DAYS = 31;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isPlanDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  // Round-trip through UTC noon: catches 2026-02-30 and month 13.
  const probe = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m! - 1 && probe.getUTCDate() === d
  );
}

/** Anchored at noon UTC so a ±14h zone shift can never cross a date boundary. */
function toUtcNoon(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!, 12);
}

function fromUtcNoon(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  return fromUtcNoon(toUtcNoon(date) + days * 86_400_000);
}

/** Inclusive count: a plan from the 1st to the 7th is 7 days. */
export function planDayCount(startDate: string, endDate: string): number {
  return Math.round((toUtcNoon(endDate) - toUtcNoon(startDate)) / 86_400_000) + 1;
}

/** Every date in the plan, inclusive of both ends. Empty when the range is inverted. */
export function enumerateDates(startDate: string, endDate: string): string[] {
  const count = planDayCount(startDate, endDate);
  if (count < 1) return [];
  return Array.from({ length: count }, (_, i) => addDays(startDate, i));
}

/**
 * "Sat 1 Aug" — for day column headers.
 *
 * The locale is pinned rather than left to the runtime. These dates render
 * inside client components that are server-rendered first, and an unpinned
 * `Intl` uses the *server's* locale during SSR and the *browser's* on
 * hydration — "Sat 1 Aug" against "sab 1 ago" is a hydration mismatch. The
 * app's copy is English throughout, so English formatting is consistent with it.
 */
export function formatPlanDate(date: string, locale = "en-GB"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** Today in a given IANA zone, as a plan date string. */
export function todayInZone(timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

export type DateRange = { startDate: string; endDate: string };

/**
 * Do two inclusive ranges share any day?
 *
 * Plain string comparison is safe because plan dates are zero-padded
 * 'YYYY-MM-DD', which sorts chronologically.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** The range in `taken` that collides with `candidate`, if any. */
export function findOverlap<T extends DateRange>(candidate: DateRange, taken: T[]): T | null {
  return taken.find((t) => rangesOverlap(candidate, t)) ?? null;
}

/** The earliest day at or after `from` that no existing range covers. */
export function firstFreeDate(from: string, taken: DateRange[]): string {
  let candidate = from;
  // Ranges are capped at 31 days and users have few plans, so walking forward
  // range by range settles immediately.
  for (let guard = 0; guard < 400; guard++) {
    const clash = taken.find((t) => candidate >= t.startDate && candidate <= t.endDate);
    if (!clash) return candidate;
    candidate = addDays(clash.endDate, 1);
  }
  return candidate;
}

/**
 * How many days a plan starting on `start` can cover before it would run into
 * an existing one. Returns 0 when the start day itself is already taken.
 */
export function daysAvailableFrom(start: string, taken: DateRange[], cap = MAX_PLAN_DAYS): number {
  if (taken.some((t) => start >= t.startDate && start <= t.endDate)) return 0;

  const nextStart = taken
    .map((t) => t.startDate)
    .filter((d) => d > start)
    .sort()[0];

  if (!nextStart) return cap;
  return Math.min(cap, planDayCount(start, nextStart) - 1);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isMealTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function mealTimeOrDefault(meal: MealType, mealTime: string | null): string {
  return mealTime && isMealTime(mealTime) ? mealTime : DEFAULT_MEAL_TIMES[meal];
}
