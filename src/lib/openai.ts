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
