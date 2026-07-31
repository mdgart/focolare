import OpenAI from "openai";

/** AI recipe features are on only when the server has an OpenAI key. */
export function isAiRecipeEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
}

/** Model overrides let deployments track OpenAI's lineup without a code change. */
export const RECIPE_PARSE_MODEL = process.env.OPENAI_PARSE_MODEL ?? "gpt-5-mini";
export const RECIPE_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

export type ImageQuality = "low" | "medium" | "high";

const IMAGE_QUALITIES: ImageQuality[] = ["low", "medium", "high"];

/**
 * Cover-photo quality, pinned rather than left to the API's `auto` default.
 *
 * `auto` lets the model choose a tier, and the tiers differ by more than an order
 * of magnitude per image — so an unpinned setting makes spend unpredictable and
 * biases upward on photographic prompts like ours. `medium` is the sensible
 * default for an image rendered at recipe-card size.
 *
 * Override with OPENAI_IMAGE_QUALITY to trade cost against fidelity without a
 * deploy; anything unrecognised falls back to medium rather than silently
 * becoming the most expensive option.
 */
export const RECIPE_IMAGE_QUALITY: ImageQuality = (() => {
  const configured = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
  return IMAGE_QUALITIES.includes(configured as ImageQuality)
    ? (configured as ImageQuality)
    : "medium";
})();
