"use client";

import { useEffect, useMemo, useState } from "react";
import { formFieldDense } from "@/lib/form-styles";
import {
  factorForTargetAmount,
  parseNumber,
  scaleIngredients,
  type RecipeIngredient,
} from "@/lib/scale-amount";
import { convertIngredient, needsLookedUpDensity, type MeasureSystem } from "@/lib/unit-convert";
import { SubstitutionsModal } from "./substitutions-modal";
import { estimateDensitiesAction } from "@/actions/density";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { substitutionsFor } from "@/lib/substitutions";

/** Offered when a recipe doesn't say how many it serves. */
const RATIOS = [0.5, 1, 2, 3];

/**
 * The ingredient list, at whatever scale the cook wants it.
 *
 * Two ways to ask, because cooks think in both: "for six people" when the
 * recipe says who it feeds, and "I've got 700 g of flour, work backwards" when
 * they're led by what's in the cupboard — the baker's way round.
 *
 * Amounts this can't read are shown exactly as written and marked, never
 * quietly passed through as if they'd been scaled.
 */
export function IngredientPanel({
  ingredients,
  servings,
  writtenIn,
  recipeTitle,
}: {
  ingredients: RecipeIngredient[];
  servings: number | null;
  recipeTitle: string;
  /** The system the recipe was written in, so the toggle knows what "as written" is. */
  writtenIn: MeasureSystem;
}) {
  const [factor, setFactor] = useState(1);
  const [byIngredient, setByIngredient] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [target, setTarget] = useState("");
  const [openSwap, setOpenSwap] = useState<number | null>(null);
  const [askingSubs, setAskingSubs] = useState(false);
  /** Null while showing the recipe's own units. */
  const [showIn, setShowIn] = useState<MeasureSystem | null>(null);
  /** Densities fetched for ingredients the curated table doesn't carry. */
  const [lookedUp, setLookedUp] = useState<Map<string, { grams: number; liquid: boolean }>>(
    () => new Map(),
  );
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!showIn) return;
    const unknown = ingredients
      .map((i) => i.name)
      .filter((name) => name && needsLookedUpDensity(name))
      .filter((name) => !lookedUp.has(normalizeIngredientName(name)));
    if (unknown.length === 0) return;

    let cancelled = false;
    // State only ever changes in the async callback, never synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLookingUp(true);
        return estimateDensitiesAction(unknown);
      })
      .then((res) => {
        if (cancelled) return;
        setLookingUp(false);
        if (res.densities.length === 0) return;
        setLookedUp((prev) => {
          const next = new Map(prev);
          for (const d of res.densities) {
            next.set(d.normalizedName, { grams: d.gramsPerCup, liquid: d.liquid });
          }
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [showIn, ingredients, lookedUp]);

  const scaled = useMemo(() => {
    const lines = scaleIngredients(ingredients, factor);
    if (!showIn) return lines.map((l) => ({ ...l, converted: false }));
    // Conversion happens per ingredient and after scaling, so an amount that
    // can't be read is simply left alone by both.
    return lines.map((line) => {
      const next = convertIngredient(line, showIn, parseNumber(line.amount ?? ""), lookedUp);
      if (!next) return { ...line, converted: false };
      return { ...line, amount: next.amount, unit: next.unit, converted: true };
    });
  }, [ingredients, factor, showIn, lookedUp]);

  const otherSystem: MeasureSystem = writtenIn === "metric" ? "us" : "metric";
  const unconvertible = showIn ? scaled.filter((l) => !l.converted && l.unit).length : 0;
  const unreadable = scaled.filter((i) => i.needsEye).length;

  // Only lines with an amount worth measuring against can anchor the scale.
  const pinnable = ingredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => factorForTargetAmount(ing.amount, 1) !== null);

  const pinned = pinnedIndex !== null ? ingredients[pinnedIndex] : undefined;

  function applyTarget(rawTarget: string, index: number | null) {
    setTarget(rawTarget);
    if (index === null) return;
    const next = factorForTargetAmount(ingredients[index]?.amount, Number(rawTarget));
    if (next !== null) setFactor(next);
  }

  const scaledServings = servings ? Math.round(servings * factor * 10) / 10 : null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
        {servings ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Serves</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFactor(Math.max(1 / servings, factor - 1 / servings))}
                disabled={Boolean(scaledServings && scaledServings <= 1)}
                className="h-7 w-7 rounded-full border border-sand-strong text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-40"
                aria-label="Fewer servings"
              >
                −
              </button>
              <span className="min-w-8 text-center font-semibold tabular-nums text-ink">
                {scaledServings}
              </span>
              <button
                type="button"
                onClick={() => setFactor(factor + 1 / servings)}
                className="h-7 w-7 rounded-full border border-sand-strong text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
                aria-label="More servings"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Scale</span>
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFactor(r)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  factor === r
                    ? "border-transparent bg-terracotta text-[#fff8f0]"
                    : "border-sand-strong text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
                }`}
              >
                ×{r}
              </button>
            ))}
          </div>
        )}

        {pinnable.length > 0 ? (
          <button
            type="button"
            onClick={() => setByIngredient((v) => !v)}
            className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-terracotta-strong hover:underline"
          >
            {byIngredient ? "Hide" : "Scale to an amount I have"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setAskingSubs(true)}
          className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-terracotta-strong hover:underline"
        >
          Missing something?
        </button>

        <button
          type="button"
          onClick={() => setShowIn(showIn ? null : otherSystem)}
          className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-terracotta-strong hover:underline"
        >
          {showIn
            ? "Back to the recipe's units"
            : otherSystem === "metric"
              ? "Show in grams and ml"
              : "Show in cups and spoons"}
        </button>

        {factor !== 1 ? (
          <button
            type="button"
            onClick={() => {
              setFactor(1);
              setTarget("");
              setPinnedIndex(null);
            }}
            className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-terracotta-strong hover:underline"
          >
            Back to as written
          </button>
        ) : null}
      </div>

      {byIngredient ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-sand bg-sunken/40 px-3 py-2.5 print:hidden">
          <label className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-muted">
            I have
            <select
              value={pinnedIndex ?? ""}
              onChange={(e) => {
                const index = e.target.value === "" ? null : Number(e.target.value);
                setPinnedIndex(index);
                applyTarget(target, index);
              }}
              className={`mt-0.5 ${formFieldDense}`}
            >
              <option value="">Choose an ingredient…</option>
              {pinnable.map(({ ing, index }) => (
                <option key={index} value={index}>
                  {ing.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-muted">
            Amount
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => applyTarget(e.target.value, pinnedIndex)}
              placeholder={pinned?.amount ?? "e.g. 700"}
              className={`mt-0.5 ${formFieldDense}`}
            />
          </label>
          {pinned?.unit ? (
            <span className="pb-2 text-sm text-ink-muted">{pinned.unit}</span>
          ) : null}
        </div>
      ) : null}

      {showIn && lookingUp ? (
        <p className="mt-3 text-xs text-ink-muted print:hidden">Looking up a few measurements…</p>
      ) : null}

      {showIn && unconvertible > 0 ? (
        <p className="mt-3 rounded-xl border border-sand-strong bg-sunken/60 px-3 py-2 text-xs text-ink-soft print:hidden">
          {unconvertible === 1 ? "One ingredient is" : `${unconvertible} ingredients are`} shown as
          written — converting a volume to a weight needs to know what the ingredient is, and this
          one isn&apos;t in the table.
        </p>
      ) : null}

      {factor !== 1 && unreadable > 0 ? (
        <p className="mt-3 rounded-xl border border-sand-strong bg-sunken/60 px-3 py-2 text-xs text-ink-soft print:hidden">
          {unreadable === 1 ? "One amount isn't" : `${unreadable} amounts aren't`} a number this can
          scale, so {unreadable === 1 ? "it's" : "they're"} shown as written — judge{" "}
          {unreadable === 1 ? "it" : "them"} by eye.
        </p>
      ) : null}

      <div className="recipe-block mt-5 overflow-hidden rounded-2xl border border-sand bg-surface">
        {scaled.length === 0 ? (
          <div className="p-6 text-center text-ink-muted">
            <p>No ingredients listed for this recipe.</p>
          </div>
        ) : (
          <ul className="divide-y divide-sand">
            {scaled.map((ing, i) => {
              const swaps = substitutionsFor(ing.name);
              return (
                <li key={i} className="transition hover:bg-sunken/40 print:hover:bg-transparent">
                  <div className="flex items-start gap-3.5 px-5 py-3.5">
                    <label className="flex flex-1 cursor-pointer items-start gap-3.5 print:cursor-default">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta print:rounded-sm"
                        aria-label={`Ingredient: ${ing.name}`}
                      />
                      <span className="text-ink">
                        {ing.amount ? (
                          <span className="font-semibold tabular-nums">{ing.amount}</span>
                        ) : null}
                        {ing.unit ? <span className="text-ink-muted"> {ing.unit}</span> : null}
                        {(ing.amount || ing.unit) && ing.name ? (
                          <span data-translate className="ml-1.5">
                            {ing.name}
                          </span>
                        ) : null}
                        {!ing.amount && !ing.unit ? <span data-translate>{ing.name}</span> : null}
                        {ing.needsEye && factor !== 1 ? (
                          <span
                            className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted"
                            title="This amount isn't a number, so it wasn't scaled."
                          >
                            as written
                          </span>
                        ) : null}
                      </span>
                    </label>

                    {swaps ? (
                      <button
                        type="button"
                        onClick={() => setOpenSwap(openSwap === i ? null : i)}
                        className="shrink-0 text-xs font-medium text-ink-muted transition hover:text-terracotta-strong print:hidden"
                        title={`What can I use instead of ${ing.name}?`}
                      >
                        {openSwap === i ? "hide" : "swap"}
                      </button>
                    ) : null}
                  </div>

                  {swaps && openSwap === i ? (
                    <div className="border-t border-sand bg-sunken/40 px-5 py-3 print:hidden">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">
                        Instead of {swaps.ingredient.toLowerCase()}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {swaps.options.map((option) => (
                          <li key={option.use}>
                            <p className="text-sm font-medium text-ink">{option.use}</p>
                            <p className="text-xs text-ink-soft">{option.ratio}</p>
                            {option.caveat ? (
                              <p className="mt-0.5 text-xs text-ink-muted">{option.caveat}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {askingSubs ? (
        <SubstitutionsModal
          ingredientNames={ingredients.map((i) => i.name).filter(Boolean)}
          recipeTitle={recipeTitle}
          onClose={() => setAskingSubs(false)}
        />
      ) : null}
    </>
  );
}
