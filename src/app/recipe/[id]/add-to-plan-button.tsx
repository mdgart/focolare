"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  listPlansForRecipePicker,
  upsertMealSlotAction,
  type PlanPickerOption,
} from "@/actions/meal-plans";
import { formFieldDense } from "@/lib/form-styles";
import { enumerateDates, formatPlanDate, MEAL_LABEL, MEAL_ORDER, type MealType } from "@/lib/meal-plan";

/**
 * Putting a recipe straight into a plan, from the recipe itself.
 *
 * The plan was previously the only way in: you had to remember the dish, open
 * the planner, find the day, and search for it again. This closes that loop at
 * the moment someone decides they want to cook something.
 *
 * Occupied slots are named before you commit, because adding to a slot that
 * already holds a recipe replaces it.
 */
export function AddToPlanButton({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<PlanPickerOption[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [date, setDate] = useState("");
  const [meal, setMeal] = useState<MealType>("dinner");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || plans !== null) return;
    let cancelled = false;
    // State changes only in the async callback, never synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    void listPlansForRecipePicker().then((res) => {
      if (cancelled) return;
      setPlans(res);
      const first = res[0];
      if (first) {
        setPlanId(first.id);
        setDate(enumerateDates(first.startDate, first.endDate)[0] ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, plans]);

  const plan = plans?.find((p) => p.id === planId);
  const dates = plan ? enumerateDates(plan.startDate, plan.endDate) : [];
  const occupiedBy = plan?.taken.find((t) => t.date === date && t.meal === meal)?.recipeTitle ?? null;

  function choosePlan(nextId: string) {
    setPlanId(nextId);
    const next = plans?.find((p) => p.id === nextId);
    if (next) setDate(enumerateDates(next.startDate, next.endDate)[0] ?? "");
  }

  function add() {
    if (!planId || !date) return;
    setError(null);
    startTransition(async () => {
      const res = await upsertMealSlotAction({ planId, date, meal, recipeId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-surface px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong print:hidden"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
          <path d="M3 8.5h14M7 3v3M13 3v3M10 11v3.5M8.25 12.75h3.5" strokeLinecap="round" />
        </svg>
        Add to plan
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-3xl border border-sand bg-surface p-5 sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
                  Meal planner
                </p>
                <h2 className="mt-1 text-xl">Add to a plan</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-sm text-ink-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            {plans === null ? (
              <p className="py-8 text-center text-sm text-ink-muted">Looking for your plans…</p>
            ) : null}

            {plans !== null && plans.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-ink-soft">You don&apos;t have a meal plan yet.</p>
                <Link href="/plan" className="btn btn-primary mt-4 inline-flex">
                  Start one
                </Link>
              </div>
            ) : null}

            {done ? (
              <div className="py-6 text-center">
                <p className="text-sm text-ink">
                  Added to <span className="font-semibold">{plan?.title}</span> for{" "}
                  {MEAL_LABEL[meal].toLowerCase()} on {formatPlanDate(date)}.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link href={`/plan/${planId}`} className="btn btn-primary">
                    Open the plan
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDone(false);
                      setOpen(false);
                    }}
                    className="btn btn-secondary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}

            {!done && plans !== null && plans.length > 0 ? (
              <div className="space-y-4">
                {plans.length > 1 ? (
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Plan
                    <select
                      value={planId}
                      onChange={(e) => choosePlan(e.target.value)}
                      className={`mt-1 ${formFieldDense}`}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({formatPlanDate(p.startDate)} – {formatPlanDate(p.endDate)})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-ink-soft">
                    <span className="font-medium text-ink">{plan?.title}</span>
                    {plan ? ` · ${formatPlanDate(plan.startDate)} – ${formatPlanDate(plan.endDate)}` : ""}
                  </p>
                )}

                <label className="block text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Day
                  <select
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`mt-1 ${formFieldDense}`}
                  >
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {formatPlanDate(d)}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Meal</p>
                  <div className="mt-1.5 flex gap-2">
                    {MEAL_ORDER.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMeal(m)}
                        className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium transition ${
                          meal === m
                            ? "border-transparent bg-terracotta text-[#fff8f0]"
                            : "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
                        }`}
                      >
                        {MEAL_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>

                {occupiedBy ? (
                  <p className="rounded-xl border border-sand-strong bg-sunken/60 px-3 py-2 text-xs text-ink-soft">
                    That slot already has <span className="font-medium text-ink">{occupiedBy}</span>.
                    Adding this will replace it.
                  </p>
                ) : null}

                {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

                <button
                  type="button"
                  onClick={add}
                  disabled={isPending || !planId || !date}
                  className="btn btn-primary w-full disabled:opacity-50"
                >
                  {isPending ? "Adding…" : occupiedBy ? "Replace it" : "Add to plan"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
