"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMealIngredientsAction } from "@/actions/grocery";
import type { MealIngredients } from "@/lib/grocery";
import { formatPlanDate, MEAL_LABEL, type MealType } from "@/lib/meal-plan";

/**
 * What one planned meal needs, without leaving the planner.
 *
 * Read straight from the recipe: no merging, no totals, amounts as written.
 * Pantry matches are flagged rather than hidden, so this reads the same way as
 * the shopping list below it.
 */
export function IngredientsModal({
  planId,
  date,
  meal,
  recipeHref,
  onClose,
}: {
  planId: string;
  date: string;
  meal: MealType;
  /** The planner already knows the recipe's address; passing it keeps the title readable-linked. */
  recipeHref: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<MealIngredients | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // State only ever changes in the async callbacks, never synchronously in the
    // effect body, which would cascade renders (react-hooks/set-state-in-effect).
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return listMealIngredientsAction({ planId, date, meal });
      })
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setData(res.meal);
      });
    return () => {
      cancelled = true;
    };
  }, [planId, date, meal]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-sand bg-surface sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-sand px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
              {MEAL_LABEL[meal]} · {formatPlanDate(date)}
            </p>
            <h2 className="mt-1 text-xl">
              {data ? (
                <Link href={recipeHref} className="hover:text-terracotta-strong">
                  {data.recipeTitle}
                </Link>
              ) : (
                "Ingredients"
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-muted">Reading the recipe…</p>
          ) : null}

          {!loading && data && data.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              This recipe doesn&apos;t list any ingredients.
            </p>
          ) : null}

          {!loading && data && data.lines.length > 0 ? (
            <ul className="space-y-1.5">
              {data.lines.map((line, i) => (
                <li key={`${line.name}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                  <span className={line.coveredByPantry ? "text-ink-muted" : "text-ink"}>
                    {line.amountText ? `${line.amountText} ` : ""}
                    {line.name}
                  </span>
                  {line.coveredByPantry ? (
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
                      already have
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="border-t border-sand px-5 py-3 text-xs text-ink-muted">
          Amounts are exactly as the recipe wrote them, never added up.
        </p>
      </div>
    </div>
  );
}
