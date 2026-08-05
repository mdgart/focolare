import OpenAI from "openai";
import { getOpenAI, isAiRecipeEnabled, RECIPE_PARSE_MODEL } from "@/lib/openai";

/**
 * The fast lane, for small structured-JSON questions.
 *
 * Two of this app's AI calls are tiny: "how much does a cup of tahini weigh"
 * and "what can I use instead of buttermilk". Both block someone staring at a
 * spinner, and both were going to `gpt-5-mini`, which took **17 seconds** to
 * answer the density question. Groq answers the same question, with the same
 * strict schema, in under two.
 *
 * Measured on eight ingredients with published reference weights, five runs
 * each — the numbers that picked the model:
 *
 * | model                    | latency | verdict                              |
 * |--------------------------|---------|--------------------------------------|
 * | groq `gpt-oss-120b`      | ~1.8s   | stable and correct — chosen          |
 * | groq `gpt-oss-20b`       | ~1.2s   | swung maple syrup 220–320 g, rejected|
 * | gemini 2.5-flash         | ~3.5s   | correct, but a third API shape       |
 * | anthropic haiku 4.5      | ~5.3s   | correct, slower than both            |
 * | openai `gpt-5-mini`      | ~17.5s  | the incumbent                        |
 *
 * The 20b model is the interesting rejection: it is the fastest of the lot and
 * scored full marks on a single run, which is exactly how you talk yourself
 * into shipping something wrong. Repeating the run five times showed maple
 * syrup landing anywhere between 220 g and 320 g per cup — a third off, on an
 * ingredient people bake with. Speed is worthless here if the number is a
 * coin flip, since a density silently rewrites an amount.
 *
 * Groq speaks the OpenAI wire format, so this reuses the SDK already installed
 * rather than adding a dependency for a different spelling of the same POST.
 */

/** Groq's OpenAI-compatible endpoint. */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * Big enough to be steady on ingredients people actually cook with.
 * Override per deployment; a bad value fails over to OpenAI below.
 */
const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL ?? "openai/gpt-oss-120b";

function getGroq(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
}

/** True when a small JSON question can be answered at all, by anyone. */
export function isFastJsonEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY) || isAiRecipeEnabled();
}

type Params = Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model">;

/**
 * Ask the fast provider, and fall back to OpenAI if it can't answer.
 *
 * The fallback is the point. Groq is a second vendor in the path of a feature
 * that used to depend on one, so an outage, a rotated key, or a retired model
 * would otherwise turn "convert to cups" into a dead button. Falling back costs
 * a slow answer; not falling back costs the answer entirely.
 *
 * Returns null only when neither provider is configured or both fail — callers
 * already treat that as "no estimate available" and show the original text.
 */
export async function fastJsonCompletion(params: Params): Promise<string | null> {
  const groq = getGroq();

  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        ...params,
        model: GROQ_FAST_MODEL,
      });
      const text = completion.choices[0]?.message?.content;
      if (text) return text;
    } catch (error) {
      // Worth a line in the log: silently paying OpenAI's latency for weeks
      // because a key was rotated is the failure this fallback could hide.
      console.error("[ai-fast] Groq failed, falling back to OpenAI:", error);
    }
  }

  if (!isAiRecipeEnabled()) return null;

  try {
    const completion = await getOpenAI().chat.completions.create({
      ...params,
      model: RECIPE_PARSE_MODEL,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[ai-fast] OpenAI fallback failed:", error);
    return null;
  }
}
