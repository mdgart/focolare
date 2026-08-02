import { ingredientCoveredBy } from "@/lib/normalize-ingredient";

/**
 * Ranking recipes for a meal slot.
 *
 * Deliberately arithmetic rather than an AI call: this runs every time someone
 * opens a slot, so it has to be instant, free, and give the same answer twice.
 * It also has to be explainable — the UI shows *why* something was suggested,
 * and "the model liked it" is not a reason a cook can act on.
 *
 * Every signal is already in the database: what they saved, what they've cooked,
 * who they follow, what's in their pantry, and how long the recipe takes.
 */

export type SuggestionCandidate = {
  recipeId: string;
  title: string;
  coverUrl: string | null;
  channelTitle: string | null;
  /** Total cook time in seconds, including durations inferred from step wording. */
  totalSeconds: number;
  /** True when some of that time was read out of prose rather than stated. */
  estimated: boolean;
  ingredientNames: string[];
  isSaved: boolean;
  isFollowedChannel: boolean;
  isOwn: boolean;
  timesCooked: number;
  cookedWithinAWeek: boolean;
  /** Rating count, used only as a weak tiebreaker. */
  popularity: number;
};

export type SlotContext = {
  timeAvailableMinutes: number | null;
  /** Normalized staple + on-hand names. */
  covered: Set<string>;
  /** Recipes already used elsewhere in this plan. */
  recipeIdsInPlan: Set<string>;
};

export type ScoredSuggestion = SuggestionCandidate & { score: number; reasons: string[] };

/**
 * 1.0 when it comfortably fits, falling away past the limit.
 *
 * Unknown duration scores neutral rather than zero — plenty of good recipes
 * simply don't state times, and burying them would make the whole feature
 * feel broken on a young catalogue.
 */
function timeFitScore(totalSeconds: number, availableMinutes: number | null): number {
  if (!availableMinutes || availableMinutes <= 0) return 0.6;
  if (totalSeconds <= 0) return 0.5;

  const ratio = totalSeconds / (availableMinutes * 60);
  if (ratio <= 1) return 1;
  if (ratio >= 2) return 0;
  // Linear fall-off: 50% over budget still scores 0.5.
  return 1 - (ratio - 1);
}

function pantryCoverage(ingredientNames: string[], covered: Set<string>): number {
  if (ingredientNames.length === 0) return 0;
  const hits = ingredientNames.filter((n) => ingredientCoveredBy(n, covered)).length;
  return hits / ingredientNames.length;
}

export function scoreCandidate(c: SuggestionCandidate, ctx: SlotContext): ScoredSuggestion {
  const fit = timeFitScore(c.totalSeconds, ctx.timeAvailableMinutes);
  const coverage = pantryCoverage(c.ingredientNames, ctx.covered);

  let score = fit * 0.35 + coverage * 0.35;
  const reasons: string[] = [];

  if (ctx.timeAvailableMinutes && c.totalSeconds > 0 && fit >= 1) {
    reasons.push(`Fits your ${ctx.timeAvailableMinutes} min`);
  }
  if (coverage >= 0.5) {
    const hits = c.ingredientNames.filter((n) => ingredientCoveredBy(n, ctx.covered)).length;
    reasons.push(`Uses ${hits} thing${hits === 1 ? "" : "s"} you have`);
  }

  if (c.isSaved) {
    score += 0.25;
    reasons.push("You saved this");
  }
  if (c.timesCooked > 0) {
    score += 0.2;
    reasons.push(c.timesCooked > 1 ? `Cooked ${c.timesCooked} times` : "You've cooked this");
  }
  if (c.isFollowedChannel) {
    score += 0.2;
    reasons.push("From someone you follow");
  }
  if (c.isOwn) {
    score += 0.1;
    reasons.push("Your recipe");
  }
  // Weak prior so a well-liked recipe edges out an unknown one, no more.
  score += Math.min(c.popularity, 20) / 20 * 0.1;

  // Variety: a plan of seven identical dinners is a worse plan.
  if (ctx.recipeIdsInPlan.has(c.recipeId)) score -= 0.3;
  if (c.cookedWithinAWeek) score -= 0.15;

  return { ...c, score, reasons };
}

export function rankCandidates(
  candidates: SuggestionCandidate[],
  ctx: SlotContext,
  limit = 12,
): ScoredSuggestion[] {
  return candidates
    .map((c) => scoreCandidate(c, ctx))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
