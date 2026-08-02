"use client";

import { useEffect, useState, useTransition } from "react";
import { upsertMealSlotAction } from "@/actions/meal-plans";
import { suggestRecipesForSlotAction } from "@/actions/suggest";
import { searchRecipesForPlanner } from "@/actions/planner-search";
import type { ScoredSuggestion } from "@/lib/suggest";
import { formField } from "@/lib/form-styles";
import { humanDurationSeconds } from "@/lib/format-duration";
import { MEAL_LABEL, type MealType } from "@/lib/meal-plan";

type Row = {
  recipeId: string;
  title: string;
  channelTitle: string | null;
  totalSeconds: number;
  estimated: boolean;
  reasons: string[];
};

/**
 * Choosing what to cook for one slot.
 *
 * Opens on suggestions rather than search: the app already knows the time
 * available, the pantry, and what this cook likes, so making them type a query
 * first wastes the most useful thing we have.
 */
export function RecipePicker({
  planId,
  slotId,
  date,
  meal,
  onClose,
  onPicked,
}: {
  planId: string;
  slotId: string;
  date: string;
  meal: MealType;
  onClose: () => void;
  onPicked: () => void;
}) {
  const [tab, setTab] = useState<"suggested" | "search">("suggested");
  const [suggestions, setSuggestions] = useState<Row[] | null>(null);
  const [results, setResults] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    // All state changes happen in async callbacks, never synchronously in the
    // effect body, which would cascade renders (react-hooks/set-state-in-effect).
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return suggestRecipesForSlotAction({ planId, slotId });
      })
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setSuggestions(res.suggestions.map(toRow));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, slotId]);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    const res = await searchRecipesForPlanner(query);
    setLoading(false);
    setResults(
      res.map((r) => ({
        recipeId: r.id,
        title: r.title,
        channelTitle: r.channelTitle,
        totalSeconds: 0,
        estimated: false,
        reasons: [],
      })),
    );
  }

  function choose(recipeId: string) {
    setError(null);
    startTransition(async () => {
      const res = await upsertMealSlotAction({ planId, date, meal, recipeId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onPicked();
    });
  }

  const rows = tab === "suggested" ? suggestions : results;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-sand bg-surface p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
              {MEAL_LABEL[meal]}
            </p>
            <h2 className="mt-1 text-xl">Choose a recipe</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-full border border-sand-strong bg-sunken p-1">
          {(["suggested", "search"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-surface text-ink shadow-sm ring-1 ring-sand-strong" : "text-ink-muted"
              }`}
            >
              {t === "suggested" ? "Suggested" : "Search"}
            </button>
          ))}
        </div>

        {tab === "search" ? (
          <div className="mb-4 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch();
                }
              }}
              placeholder="Search recipes…"
              className={`${formField} flex-1`}
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              className="btn btn-primary shrink-0 !px-5 !py-2 text-sm"
            >
              Search
            </button>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm font-medium text-red-700">{error}</p> : null}
        {loading ? <p className="py-8 text-center text-sm text-ink-muted">Looking…</p> : null}

        {!loading && rows && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            {tab === "suggested"
              ? "No suggestions yet — try searching, or save a few recipes first."
              : "Nothing matched that."}
          </p>
        ) : null}

        {!loading && rows && rows.length > 0 ? (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.recipeId}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => choose(r.recipeId)}
                  className="w-full rounded-xl border border-sand bg-[#fffdf8] px-4 py-3 text-left transition hover:border-terracotta disabled:opacity-60"
                >
                  <span className="block font-medium text-ink">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {r.channelTitle ? `${r.channelTitle} · ` : ""}
                    {r.totalSeconds > 0
                      ? `${humanDurationSeconds(r.totalSeconds)}${r.estimated ? " (est.)" : ""}`
                      : "No time given"}
                  </span>
                  {r.reasons.length > 0 ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {r.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-terracotta-tint px-2 py-0.5 text-[0.65rem] font-medium text-terracotta-strong"
                        >
                          {reason}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function toRow(s: ScoredSuggestion): Row {
  return {
    recipeId: s.recipeId,
    title: s.title,
    channelTitle: s.channelTitle,
    totalSeconds: s.totalSeconds,
    estimated: s.estimated,
    reasons: s.reasons,
  };
}
