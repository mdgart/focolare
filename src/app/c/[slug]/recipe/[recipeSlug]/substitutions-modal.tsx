"use client";

import { useState } from "react";
import { suggestSubstitutionsAction, type SubstitutionAnswer } from "@/actions/substitutions";
import type { ChosenSubstitution } from "@/lib/ingredient-prefs";

/**
 * "What can I use instead of…" for any ingredient, not just the known ones.
 *
 * Pick the ones you're missing, ask once, get answers together. The
 * hand-written table still answers where it can — instant, free, and checked by
 * a person — and everything else goes to the model, which is the only way to
 * cover an ingredient list nobody can enumerate in advance.
 *
 * Model answers are labelled as such and carry a standing warning, because this
 * is advice about food that can be confidently wrong. The warning is deliberately
 * at the top rather than buried per-row: by the time someone is reading the
 * third suggestion they've stopped noticing badges.
 */
export function SubstitutionsModal({
  ingredientNames,
  recipeTitle,
  chosen,
  onChoose,
  onClose,
}: {
  ingredientNames: string[];
  recipeTitle: string;
  /** Swaps already in force, so the list can show which one is picked. */
  chosen: ChosenSubstitution[];
  onChoose: (choice: ChosenSubstitution) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<SubstitutionAnswer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function ask() {
    if (picked.size === 0) return;
    setError(null);
    setLoading(true);
    void suggestSubstitutionsAction({ names: [...picked], recipeTitle }).then((res) => {
      setLoading(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setAnswers(res.answers);
    });
  }

  const usedAi = answers?.some((a) => a.source === "ai") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-sand bg-surface sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-sand px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
              Missing something?
            </p>
            <h2 className="mt-1 text-xl">Find a substitute</h2>
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
          {answers === null ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Tick what you haven&apos;t got, and we&apos;ll suggest what to use instead.
              </p>
              <ul className="space-y-1">
                {ingredientNames.map((name) => (
                  <li key={name}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-sunken/60">
                      <input
                        type="checkbox"
                        checked={picked.has(name)}
                        onChange={() => toggle(name)}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta"
                      />
                      <span className="min-w-0 text-sm text-ink">{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {answers !== null ? (
            <>
              {usedAi ? (
                <p className="mb-4 rounded-xl border border-terracotta/40 bg-terracotta-tint/50 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                  <span className="font-semibold text-terracotta-strong">
                    Some of these are AI suggestions and can be wrong.
                  </span>{" "}
                  Ratios especially — baking punishes a bad one. Treat them as a starting point, and
                  don&apos;t rely on them for an allergy.
                </p>
              ) : null}

              {answers.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  No substitutions to offer for those.
                </p>
              ) : null}

              <ul className="space-y-4">
                {answers.map((answer) => (
                  <li key={answer.ingredient}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-semibold text-ink">
                        Instead of {answer.ingredient.toLowerCase()}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                          answer.source === "ai"
                            ? "bg-terracotta-tint text-terracotta-strong"
                            : "bg-sunken text-ink-muted"
                        }`}
                      >
                        {answer.source === "ai" ? "AI suggestion" : "From our table"}
                      </span>
                    </div>

                    {answer.options.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        Nothing reliable to suggest for this one.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {answer.options.map((option) => {
                          const picked = chosen.some(
                            (c) => c.forIngredient === answer.ingredient && c.use === option.use,
                          );
                          return (
                            <li
                              key={option.use}
                              className={`rounded-xl px-3 py-2 ${
                                picked ? "bg-terracotta-tint" : "bg-sunken/50"
                              }`}
                            >
                              <p className="text-sm font-medium text-ink">{option.use}</p>
                              <p className="text-xs text-ink-soft">{option.ratio}</p>
                              {option.caveat ? (
                                <p className="mt-0.5 text-xs text-ink-muted">{option.caveat}</p>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  onChoose({
                                    forIngredient: answer.ingredient,
                                    use: picked ? "" : option.use,
                                    ratio: option.ratio,
                                  })
                                }
                                className="mt-1.5 text-xs font-medium text-terracotta-strong underline-offset-2 hover:underline"
                              >
                                {picked ? "Using this — undo" : "Use this"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
        </div>

        <div className="border-t border-sand px-5 py-3">
          {answers === null ? (
            <button
              type="button"
              onClick={ask}
              disabled={loading || picked.size === 0}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {loading
                ? "Asking…"
                : picked.size === 0
                  ? "Pick an ingredient"
                  : `Suggest substitutes for ${picked.size}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAnswers(null);
                setPicked(new Set());
              }}
              className="btn btn-secondary w-full"
            >
              Ask about something else
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
