"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveIngredientPrefsAction } from "@/actions/ingredient-prefs";
import {
  DEFAULT_PREFS,
  prefsAreCustomised,
  type IngredientPrefs,
} from "@/lib/ingredient-prefs";
import { factorForTargetAmount, type RecipeIngredient } from "@/lib/scale-amount";
import type { MeasureSystem } from "@/lib/unit-convert";

const RATIOS = [0.5, 1, 2, 3];

/**
 * The same reading controls as the recipe page, on the cook screen.
 *
 * They write the same per-recipe preference, so a scale set while reading is
 * already applied when cooking starts — and changing it mid-cook sticks for
 * next time. The server re-renders the list, so there's one place that turns
 * preferences into ingredient lines (`applyPrefs`) and no second copy to drift.
 */
export function IngredientControls({
  recipeId,
  prefs,
  writtenIn,
  baseIngredients,
}: {
  recipeId: string;
  prefs: IngredientPrefs;
  writtenIn: MeasureSystem;
  /** Unscaled, so "I have this much" measures against what the recipe wrote. */
  baseIngredients: RecipeIngredient[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [byIngredient, setByIngredient] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [target, setTarget] = useState("");

  function update(next: IngredientPrefs) {
    startTransition(async () => {
      await saveIngredientPrefsAction({ recipeId, prefs: next });
      router.refresh();
    });
  }

  const factor = prefs.scalePercent / 100;
  const showIn = prefs.unitSystem === "recipe" ? null : prefs.unitSystem;
  const otherSystem: MeasureSystem = writtenIn === "metric" ? "us" : "metric";

  const pinnable = baseIngredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => factorForTargetAmount(ing.amount, 1) !== null);

  function applyTarget(raw: string, index: number | null) {
    setTarget(raw);
    if (index === null) return;
    const next = factorForTargetAmount(baseIngredients[index]?.amount, Number(raw));
    if (next !== null) {
      update({ ...prefs, scalePercent: Math.round(Math.min(10, Math.max(0.1, next)) * 100) });
    }
  }

  const chip = "rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";
  const off = "border-stone-200 bg-white text-stone-600 hover:text-stone-900";
  const on = "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Making</span>
        {RATIOS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={isPending}
            onClick={() => update({ ...prefs, scalePercent: r * 100 })}
            className={`${chip} ${factor === r ? on : off}`}
          >
            ×{r}
          </button>
        ))}

        <button
          type="button"
          disabled={isPending}
          onClick={() => update({ ...prefs, unitSystem: showIn ? "recipe" : otherSystem })}
          className={`${chip} ${showIn ? on : off}`}
        >
          {showIn
            ? "Recipe's units"
            : otherSystem === "metric"
              ? "Grams and ml"
              : "Cups and spoons"}
        </button>

        {pinnable.length > 0 ? (
          <button
            type="button"
            onClick={() => setByIngredient((v) => !v)}
            className={`${chip} ${byIngredient ? on : off}`}
          >
            Amount I have
          </button>
        ) : null}

        {prefsAreCustomised(prefs) ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              update(DEFAULT_PREFS);
              setTarget("");
              setPinnedIndex(null);
            }}
            className={`${chip} ${off}`}
          >
            As written
          </button>
        ) : null}
      </div>

      {byIngredient ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-2">
          <label className="text-[0.7rem] font-medium uppercase tracking-wide text-stone-500">
            I have
            <select
              value={pinnedIndex ?? ""}
              onChange={(e) => {
                const index = e.target.value === "" ? null : Number(e.target.value);
                setPinnedIndex(index);
                applyTarget(target, index);
              }}
              className="mt-0.5 block rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
            >
              <option value="">Choose…</option>
              {pinnable.map(({ ing, index }) => (
                <option key={index} value={index}>
                  {ing.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[0.7rem] font-medium uppercase tracking-wide text-stone-500">
            Amount
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => applyTarget(e.target.value, pinnedIndex)}
              placeholder={pinnedIndex !== null ? baseIngredients[pinnedIndex]?.amount : "e.g. 700"}
              className="mt-0.5 block w-24 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
