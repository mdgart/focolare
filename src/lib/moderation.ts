import { getOpenAI, isAiRecipeEnabled } from "@/lib/openai";
import { localFileAsDataUrl, usingBlobStorage } from "@/lib/storage";

/**
 * Content safety for user submissions, backed by OpenAI's `omni-moderation-latest`
 * (free, and accepts text and images in one call).
 *
 * Two-level outcome so honest cooks are never blocked by a borderline score:
 *   reject — high confidence in a severe category; the save is refused outright
 *   flag   — plausible violation; the recipe saves but stays out of public listings
 *            until an admin clears it
 */
export type ModerationVerdict =
  | { action: "allow" }
  | { action: "flag"; categories: FlaggedCategory[] }
  | { action: "reject"; categories: FlaggedCategory[]; message: string };

export type FlaggedCategory = { category: string; score: number };

/**
 * Per-category thresholds. Cooking writing trips generic violence detectors
 * constantly ("butcher the chicken", "bleed the fish", "kill the yeast", every
 * charcuterie recipe), so plain violence needs a high bar while abuse categories
 * stay tight. Scores are 0–1.
 */
const POLICY: Record<string, { reject: number; flag: number }> = {
  "sexual/minors": { reject: 0.2, flag: 0.05 },
  sexual: { reject: 0.7, flag: 0.35 },
  "hate/threatening": { reject: 0.4, flag: 0.15 },
  hate: { reject: 0.6, flag: 0.3 },
  "harassment/threatening": { reject: 0.6, flag: 0.3 },
  harassment: { reject: 0.85, flag: 0.5 },
  "self-harm/instructions": { reject: 0.4, flag: 0.15 },
  "self-harm/intent": { reject: 0.6, flag: 0.3 },
  "self-harm": { reject: 0.7, flag: 0.4 },
  "illicit/violent": { reject: 0.5, flag: 0.25 },
  illicit: { reject: 0.8, flag: 0.5 },
  // Deliberately permissive: butchery, curing and game cookery are on-topic here.
  "violence/graphic": { reject: 0.95, flag: 0.85 },
  violence: { reject: 0.97, flag: 0.9 },
};

const DEFAULT_POLICY = { reject: 0.8, flag: 0.5 };

const REJECT_MESSAGE =
  "This content was blocked by our safety check. If you believe that's a mistake, edit the wording or image and try again.";

export type RecipeContentForModeration = {
  title: string;
  description?: string | null;
  ingredients?: { name: string; amount?: string | null; unit?: string | null }[];
  steps?: { title?: string | null; instruction: string }[];
  tags?: string[];
};

/** Flattens the parts of a recipe a person actually reads into one text blob. */
export function recipeToModerationText(r: RecipeContentForModeration): string {
  const lines: string[] = [r.title];
  if (r.description?.trim()) lines.push(r.description);
  for (const i of r.ingredients ?? []) {
    lines.push([i.amount, i.unit, i.name].filter(Boolean).join(" "));
  }
  for (const s of r.steps ?? []) {
    if (s.title?.trim()) lines.push(s.title);
    lines.push(s.instruction);
  }
  if (r.tags?.length) lines.push(r.tags.join(", "));
  return lines.join("\n").slice(0, 30_000);
}

function verdictFromScores(scores: Record<string, number>): ModerationVerdict {
  const rejected: FlaggedCategory[] = [];
  const flagged: FlaggedCategory[] = [];

  for (const [category, rawScore] of Object.entries(scores)) {
    const score = typeof rawScore === "number" ? rawScore : 0;
    const policy = POLICY[category] ?? DEFAULT_POLICY;
    if (score >= policy.reject) rejected.push({ category, score });
    else if (score >= policy.flag) flagged.push({ category, score });
  }

  const bySeverity = (a: FlaggedCategory, b: FlaggedCategory) => b.score - a.score;
  if (rejected.length > 0) {
    return { action: "reject", categories: rejected.sort(bySeverity), message: REJECT_MESSAGE };
  }
  if (flagged.length > 0) return { action: "flag", categories: flagged.sort(bySeverity) };
  return { action: "allow" };
}

/** Merges several moderation results, keeping the highest score seen per category. */
function mergeScores(all: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const scores of all) {
    for (const [k, v] of Object.entries(scores)) {
      if (typeof v === "number" && (merged[k] == null || v > merged[k]!)) merged[k] = v;
    }
  }
  return merged;
}

/**
 * Runs text and (optionally) images through moderation.
 * Returns `allow` when moderation isn't configured — the feature is additive,
 * and a missing key must never block people from publishing.
 */
export async function moderateContent(input: {
  text?: string;
  images?: { storageKey: string; mimeType: string; publicUrl?: string | null }[];
}): Promise<ModerationVerdict> {
  if (!isAiRecipeEnabled()) return { action: "allow" };

  const parts: Record<string, unknown>[] = [];
  if (input.text?.trim()) parts.push({ type: "text", text: input.text });

  for (const img of (input.images ?? []).slice(0, 4)) {
    // Blob objects are already on a public CDN, so the moderation API can fetch them
    // directly. Local uploads aren't reachable from outside, so those get inlined.
    if (usingBlobStorage() && img.publicUrl) {
      parts.push({ type: "image_url", image_url: { url: img.publicUrl } });
      continue;
    }
    const dataUrl = await localFileAsDataUrl(img.storageKey, img.mimeType);
    if (dataUrl) parts.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  if (parts.length === 0) return { action: "allow" };

  try {
    const openai = getOpenAI();
    const res = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: parts as never,
    });
    const scores = mergeScores(
      res.results.map((r) => r.category_scores as unknown as Record<string, number>),
    );
    return verdictFromScores(scores);
  } catch (e) {
    // Never block publishing because the safety service is down; flag for a human instead.
    console.error("[moderation] check failed, flagging for review:", e);
    return { action: "flag", categories: [{ category: "check-failed", score: 0 }] };
  }
}
