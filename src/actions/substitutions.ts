"use server";

import { substitutionsFor, type Substitution } from "@/lib/substitutions";
import { fastJsonCompletion, isFastJsonEnabled } from "@/lib/ai-fast";
import { getServerSession } from "@/lib/session";

export type SubstitutionAnswer = {
  ingredient: string;
  options: Substitution[];
  /**
   * "table" is hand-written and checked by a person; "ai" is a suggestion that
   * may be wrong. The UI says which, because the two deserve different trust.
   */
  source: "table" | "ai";
};

/** One request per ask, however many ingredients were ticked. */
const MAX_INGREDIENTS = 12;

const SYSTEM_PROMPT = `You suggest substitutions for cooking ingredients, for a recipe app.

Rules:
- Give at most three options per ingredient, best first, and only substitutions a competent cook would actually make.
- Every option needs a ratio: how much of the replacement to use for the amount the recipe asked for.
- Every option needs a caveat naming where the swap changes the result — texture, flavour, whether it sets, whether it rises. If a swap genuinely behaves the same, say so plainly.
- Take the dish into account when you're told it: a swap that works in a braise may ruin a pastry.
- If you don't know a good substitution for something, return it with an empty options list rather than inventing one. Silence is a usable answer; a plausible wrong ratio is not.
- Never suggest something as an allergy-safe replacement. You aren't told why the cook is substituting, and it isn't safe to assume.`;

/**
 * Substitutions for whichever ingredients the cook picked.
 *
 * The hand-written table answers first where it can: it's instant, free, the
 * same every time, and a person checked it. Everything else goes to the model,
 * which covers the long tail the table never will — gochujang, a regional
 * cheese, whatever someone actually has in the cupboard.
 *
 * Model answers come back marked `source: "ai"` and the UI says so. This is
 * advice about food that can be confidently wrong, and the difference between
 * "a cookbook says this" and "a model thinks this" is the cook's to weigh.
 */
export async function suggestSubstitutionsAction(input: {
  names: string[];
  /** The dish, so a swap can be judged against what it's going into. */
  recipeTitle?: string;
}): Promise<{ answers: SubstitutionAnswer[] } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to ask for substitutions." };

  const names = [...new Set(input.names.map((n) => n.trim()).filter(Boolean))].slice(
    0,
    MAX_INGREDIENTS,
  );
  if (names.length === 0) return { answers: [] };

  const answers: SubstitutionAnswer[] = [];
  const unknown: string[] = [];

  for (const name of names) {
    const known = substitutionsFor(name);
    if (known) {
      answers.push({ ingredient: known.ingredient, options: known.options, source: "table" });
    } else {
      unknown.push(name);
    }
  }

  if (unknown.length === 0) return { answers };
  if (!isFastJsonEnabled()) return { answers };

  try {
    // Same fast lane as the density lookup: a modal is open, waiting.
    const answer = await fastJsonCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            input.recipeTitle ? `Dish: ${input.recipeTitle}` : null,
            "Ingredients to substitute:",
            ...unknown.map((n) => `- ${n}`),
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "substitutions",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    ingredient: { type: "string" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          use: { type: "string", description: "What to use instead" },
                          ratio: { type: "string", description: "How much, for the amount asked" },
                          caveat: { type: "string", description: "Where it changes the result" },
                        },
                        required: ["use", "ratio", "caveat"],
                      },
                    },
                  },
                  required: ["ingredient", "options"],
                },
              },
            },
            required: ["results"],
          },
        },
      },
    });

    const raw = JSON.parse(answer ?? "{}") as {
      results?: { ingredient: string; options: { use: string; ratio: string; caveat: string }[] }[];
    };

    for (const result of raw.results ?? []) {
      answers.push({
        ingredient: result.ingredient,
        options: (result.options ?? []).slice(0, 3),
        source: "ai",
      });
    }
  } catch {
    // The table's answers are still worth returning; the rest simply have none.
    return { answers };
  }

  return { answers };
}
