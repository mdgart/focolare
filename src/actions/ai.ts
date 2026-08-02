"use server";

import { getAiQuota, quotaExceededMessage, recordAiUsage } from "@/lib/entitlements";
import { getServerSession } from "@/lib/session";
import { normalizeLanguage } from "@/lib/languages";
import { getOpenAI, isAiRecipeEnabled, RECIPE_PARSE_MODEL } from "@/lib/openai";

export type ParsedRecipeDraft = {
  title: string;
  description: string;
  /** BCP-47 base code detected from the pasted text. */
  language: string;
  ingredientMeasureSystem: "metric" | "us";
  ingredients: { amount: string | null; unit: string | null; name: string }[];
  tags: string[];
  /** Matches one of the category ids offered to the model, when confident. */
  taxonomyCategoryId: string | null;
  steps: {
    title: string;
    instruction: string;
    durationSeconds: number | null;
    offsetFromPrevious: number;
  }[];
};

const MAX_INPUT_CHARS = 20_000;

type RawParsed = {
  title: string;
  description: string;
  language: string;
  ingredient_measure_system: "metric" | "us";
  ingredients: { amount: string | null; unit: string | null; name: string }[];
  tags: string[];
  category_id: string | null;
  steps: {
    title: string;
    instruction: string;
    duration_minutes: number | null;
    wait_before_minutes: number;
  }[];
};

function recipeJsonSchema(categoryIds: string[]) {
  return {
    name: "structured_recipe",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Short recipe title in title case" },
        description: {
          type: "string",
          description: "One or two appetizing sentences summarizing the dish. Write it if the source has none.",
        },
        language: {
          type: "string",
          description:
            "BCP-47 base code for the language the SOURCE TEXT is written in, e.g. \"en\", \"it\", \"fr\". Keep the recipe in its original language — do not translate it.",
        },
        ingredient_measure_system: {
          type: "string",
          enum: ["metric", "us"],
          description: "metric when amounts are mostly g/kg/ml/L, us when mostly cups/tbsp/tsp/oz/lb",
        },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              amount: {
                type: ["string", "null"],
                description: "Numeric amount as written, e.g. \"500\", \"1½\", \"2-3\". null when none.",
              },
              unit: { type: ["string", "null"], description: "Unit as written, e.g. \"g\", \"cups\". null when none." },
              name: { type: "string", description: "Ingredient name plus prep notes, e.g. \"onion, finely diced\"" },
            },
            required: ["amount", "unit", "name"],
          },
        },
        tags: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
          description: "Up to 6 short lowercase tags, e.g. \"sourdough\", \"weeknight\"",
        },
        category_id: {
          type: ["string", "null"],
          enum: [...categoryIds, null],
          description: "The offered category id that best fits the dish, or null when unsure",
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string", description: "2-4 word action label, e.g. \"Bulk ferment\". Empty string if none fits." },
              instruction: { type: "string", description: "The step's instructions, faithful to the source text" },
              duration_minutes: {
                type: ["integer", "null"],
                description:
                  "Active or passive time this step takes when the text states or clearly implies it (bake 40 min → 40; overnight → 480). null when the text gives no time.",
              },
              wait_before_minutes: {
                type: "integer",
                description: "Idle gap between the previous step finishing and this one starting, when the text implies one. 0 otherwise.",
              },
            },
            required: ["title", "instruction", "duration_minutes", "wait_before_minutes"],
          },
        },
      },
      required: [
        "title",
        "description",
        "language",
        "ingredient_measure_system",
        "ingredients",
        "tags",
        "category_id",
        "steps",
      ],
    },
  } as const;
}

const SYSTEM_PROMPT = `You convert pasted, free-form recipe text into structured data for a cooking app.

Rules:
- Extract faithfully. Never invent ingredients, amounts, or steps that are not in the text; light rewording for clarity is fine.
- Split the method by *timing*, not by sentence. A step earns its own row only when it contains a wait the cook could walk away from — roughly five minutes or more of baking, proving, resting, chilling, simmering or marinating. Everything else gets folded into the step beside it.
- Short attended actions never get their own step, even when the text gives them a time. "Add the garlic and cook for another minute", "toast the spices for 30 seconds", "bring a pan of water to the boil" belong inside the step around them, with the timing kept in the wording.
- Consecutive hands-on actions belong in ONE step: "peel and dice the onion", "measure the flour" and "grease the tin" is one step, not three. Gathering them up is not inventing — keep the source wording, just under a single instruction.
- Worked example. This method:
    "Chop the onion. Slice the garlic. Grate the cheese. Put a pan of salted water on to boil. Heat oil, add the onion and cook 8 minutes until soft. Add the garlic and cook 1 minute. Tip in tomatoes, simmer 25 minutes. Meanwhile cook the pasta 9 minutes. Drain and toss with the sauce."
  is FOUR steps, not eight: (1) prep everything and get the water on, (2) soften the onion, then the garlic, 8 min, (3) simmer the sauce, 25 min, (4) cook the pasta and toss it through, 9 min.
- Aim for 4-6 steps for a weeknight dish. More than 8 means hands-on actions were split that should have been gathered up.
- Time fields power real kitchen timers, so only set them from times the text states or clearly implies ("overnight" ≈ 8 hours, "until doubled, about 1 hour" → 60).
- If the pasted text is not a recipe at all, still fill the schema: use an empty ingredients array, one step whose instruction says the text does not look like a recipe, and an empty title.`;

/** Shared plumbing: one schema, one normalisation path, two different system prompts. */
async function runRecipeCompletion(input: {
  systemPrompt: string;
  userContent: string;
  categories: { id: string; label: string }[];
}): Promise<{ draft: ParsedRecipeDraft } | { error: string }> {
  const categories = input.categories.slice(0, 100);
  const categoryList = categories.map((c) => `${c.id} = ${c.label}`).join("\n");

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: RECIPE_PARSE_MODEL,
      messages: [
        { role: "system", content: input.systemPrompt },
        {
          role: "user",
          content: `Available categories (id = label):\n${categoryList || "(none)"}\n\n${input.userContent}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: recipeJsonSchema(categories.map((c) => c.id)),
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { error: "The AI returned an empty response — try again." };
    const raw = JSON.parse(content) as RawParsed;

    const validCategory = raw.category_id && categories.some((c) => c.id === raw.category_id)
      ? raw.category_id
      : null;

    const draft: ParsedRecipeDraft = {
      title: raw.title.trim(),
      description: raw.description.trim(),
      language: normalizeLanguage(raw.language),
      ingredientMeasureSystem: raw.ingredient_measure_system === "us" ? "us" : "metric",
      ingredients: raw.ingredients
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          amount: i.amount?.trim() || null,
          unit: i.unit?.trim() || null,
          name: i.name.trim(),
        })),
      tags: raw.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 6),
      taxonomyCategoryId: validCategory,
      steps: raw.steps
        .filter((s) => s.instruction.trim().length > 0)
        .map((s, i) => ({
          title: s.title.trim(),
          instruction: s.instruction.trim(),
          durationSeconds:
            s.duration_minutes != null && s.duration_minutes > 0 ? Math.round(s.duration_minutes) * 60 : null,
          offsetFromPrevious: i === 0 ? 0 : Math.max(0, Math.round(s.wait_before_minutes)) * 60,
        })),
    };

    if (!draft.steps.length) return { error: "The result had no cooking steps — try again." };
    return { draft };
  } catch (e) {
    console.error("[ai] recipe completion failed:", e);
    return { error: "The AI request failed — try again in a moment." };
  }
}

export async function parseRecipeTextAction(input: {
  text: string;
  categories: { id: string; label: string }[];
}): Promise<{ draft: ParsedRecipeDraft } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to use AI import." };
  if (!isAiRecipeEnabled()) return { error: "AI import is not configured on this server." };

  const text = input.text.trim();
  if (text.length < 40) return { error: "Paste the whole recipe first (a few lines at least)." };
  if (text.length > MAX_INPUT_CHARS) {
    return { error: `That's too long — keep it under ${MAX_INPUT_CHARS.toLocaleString()} characters.` };
  }

  const quota = await getAiQuota(session.user.id, "recipe");
  if (!quota.allowed) return { error: quotaExceededMessage("recipe", quota) };

  const res = await runRecipeCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Recipe text:\n"""\n${text}\n"""`,
    categories: input.categories,
  });
  // Only bill for calls that actually produced a recipe.
  if (!("error" in res)) await recordAiUsage(session.user.id, "recipe");
  return res;
}

const INVENT_PROMPT = `You invent a practical, genuinely cookable recipe for a cooking app, from whatever the user has on hand or has in mind.

Rules:
- Cook like a sensible home cook, not a stunt chef. Favour ordinary technique and equipment.
- When the user lists ingredients they have, build the dish around those and keep additions to common staples (salt, pepper, oil, butter, flour, onion, garlic, stock, basic spices). Say so in the description if you add anything notable.
- Give real amounts. Every ingredient needs a usable quantity — never "some" or "to taste" as the only measure.
- Split the method by *timing*, not by sentence. A step earns its own row only when it contains a wait the cook could walk away from — roughly five minutes or more of baking, proving, resting, chilling or simmering. Fold everything else into the step beside it.
- Short attended actions never get their own step, even when you give them a time: softening garlic for a minute or bringing water to the boil belongs inside the surrounding step, with the timing in the wording. Consecutive hands-on actions — chopping, measuring, greasing a tin — are one step, not three.
- Aim for 4-6 steps for a weeknight dish. More than 8 means hands-on actions were split that should have been gathered up.
- Time fields drive real kitchen timers, so give honest durations for anything that takes time (simmering, roasting, resting, proving) and leave them null for instant actions.
- Set the language field to the language the USER wrote their request in, and write the whole recipe in that same language.
- If the request is impossible or not about food, still fill the schema: empty title, empty ingredients, and one step whose instruction explains why you can't make a recipe from it.`;

export async function generateRecipeAction(input: {
  /** Ingredients on hand, a craving, or a rough description. */
  idea: string;
  servings?: string;
  /** Free-form extras: time budget, dietary needs, equipment. */
  constraints?: string;
  categories: { id: string; label: string }[];
}): Promise<{ draft: ParsedRecipeDraft } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to use AI." };
  if (!isAiRecipeEnabled()) return { error: "AI is not configured on this server." };

  const idea = input.idea.trim();
  if (idea.length < 3) return { error: "Tell us what you have, or what you feel like making." };
  if (idea.length > 2_000) return { error: "Keep it shorter — a list or a couple of sentences." };

  const quota = await getAiQuota(session.user.id, "recipe");
  if (!quota.allowed) return { error: quotaExceededMessage("recipe", quota) };

  const parts = [`What the cook has / wants:\n"""\n${idea}\n"""`];
  if (input.servings?.trim()) parts.push(`Servings: ${input.servings.trim().slice(0, 40)}`);
  if (input.constraints?.trim()) {
    parts.push(`Constraints: ${input.constraints.trim().slice(0, 400)}`);
  }

  const res = await runRecipeCompletion({
    systemPrompt: INVENT_PROMPT,
    userContent: parts.join("\n\n"),
    categories: input.categories,
  });
  if (!("error" in res)) await recordAiUsage(session.user.id, "recipe");
  return res;
}

/** Remaining AI allowance, for showing credits in the UI. */
export async function getAiCreditsAction(): Promise<
  { recipes: { used: number; limit: number; remaining: number }; images: { used: number; limit: number; remaining: number }; plan: string } | null
> {
  const session = await getServerSession();
  if (!session?.user?.id) return null;
  const [recipes, images] = await Promise.all([
    getAiQuota(session.user.id, "recipe"),
    getAiQuota(session.user.id, "image"),
  ]);
  return {
    plan: recipes.plan,
    recipes: { used: recipes.used, limit: recipes.limit, remaining: recipes.remaining },
    images: { used: images.used, limit: images.limit, remaining: images.remaining },
  };
}
