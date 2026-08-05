"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { ingredientDensity } from "@/db/schema";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { fastJsonCompletion, isFastJsonEnabled } from "@/lib/ai-fast";
import { getServerSession } from "@/lib/session";

export type EstimatedDensity = {
  normalizedName: string;
  gramsPerCup: number;
  liquid: boolean;
};

/** Beyond this, the model is guessing at something that isn't a real ingredient. */
const PLAUSIBLE_GRAMS_PER_CUP = { min: 15, max: 500 };

/** One request per conversion, however many ingredients it covers. */
const MAX_NAMES = 30;

const SYSTEM_PROMPT = `You give the weight of one US cup of an ingredient, for a cooking app converting recipes between cups and grams.

Rules:
- Answer only for ingredients you actually know. If you are not confident of the figure, omit that ingredient entirely — a wrong density silently ruins a recipe, and the app shows the original measurement when you say nothing.
- grams_per_cup is the weight of one level US cup (237 ml) of the ingredient as a recipe would use it.
- liquid is true for things measured by volume in a metric kitchen (water, milks, oils, syrups, stocks), false for solids that would be weighed (flours, sugars, grains, powders).
- Omit anything that isn't a food ingredient.`;

/**
 * Densities for ingredients the hand-written table doesn't cover.
 *
 * The curated table in `src/lib/unit-convert.ts` stays the first answer: it's
 * instant, free, and the same every time. This is the fallback for everything
 * else — gochujang, tahini, a regional flour — so a conversion isn't refused
 * just because the table is finite.
 *
 * Answers are cached in the database, because the grams in a cup of gochujang is
 * the same for every user and it's a slow, paid question to ask twice. They're
 * also marked as estimates so the UI can say where the number came from: this is
 * the one place in the app where an ingredient amount is a model's opinion
 * rather than arithmetic, and the cook should know which they're looking at.
 */
export async function estimateDensitiesAction(
  names: string[],
): Promise<{ densities: EstimatedDensity[] }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { densities: [] };

  const wanted = [...new Set(names.map(normalizeIngredientName).filter(Boolean))].slice(0, MAX_NAMES);
  if (wanted.length === 0) return { densities: [] };

  const cached = await db
    .select({
      normalizedName: ingredientDensity.normalizedName,
      gramsPerCup: ingredientDensity.gramsPerCup,
      liquid: ingredientDensity.liquid,
    })
    .from(ingredientDensity)
    .where(inArray(ingredientDensity.normalizedName, wanted));

  const missing = wanted.filter((n) => !cached.some((c) => c.normalizedName === n));
  if (missing.length === 0 || !isFastJsonEnabled()) return { densities: cached };

  let fresh: EstimatedDensity[] = [];
  try {
    // Small, schema-bound, and someone is waiting on it — the fast lane.
    const answer = await fastJsonCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: missing.join("\n") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "densities",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              densities: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string", description: "The ingredient, exactly as given" },
                    grams_per_cup: { type: "integer" },
                    liquid: { type: "boolean" },
                  },
                  required: ["name", "grams_per_cup", "liquid"],
                },
              },
            },
            required: ["densities"],
          },
        },
      },
    });

    const raw = JSON.parse(answer ?? "{}") as {
      densities?: { name: string; grams_per_cup: number; liquid: boolean }[];
    };

    fresh = (raw.densities ?? [])
      .map((d) => ({
        normalizedName: normalizeIngredientName(d.name),
        gramsPerCup: Math.round(d.grams_per_cup),
        liquid: Boolean(d.liquid),
      }))
      // Only what was asked for, and only figures in a believable range — a
      // model that returns 3000 g per cup has misunderstood the question, and
      // that number would come out the other side as a real measurement.
      .filter(
        (d) =>
          missing.includes(d.normalizedName) &&
          Number.isFinite(d.gramsPerCup) &&
          d.gramsPerCup >= PLAUSIBLE_GRAMS_PER_CUP.min &&
          d.gramsPerCup <= PLAUSIBLE_GRAMS_PER_CUP.max,
      );
  } catch {
    // An unavailable model means the conversion falls back to same-kind units,
    // which is exactly what happened before this existed.
    return { densities: cached };
  }

  if (fresh.length > 0) {
    await db
      .insert(ingredientDensity)
      .values(fresh.map((d) => ({ ...d, source: "ai" })))
      .onConflictDoNothing();
  }

  return { densities: [...cached, ...fresh] };
}
