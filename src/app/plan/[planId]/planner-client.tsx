"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  removeMealSlotAction,
  setPlanSharingAction,
  upsertMealSlotAction,
  type PlanDetail,
  type PlanSlotRow,
} from "@/actions/meal-plans";
import { fillPlanAction } from "@/actions/suggest";
import { formFieldDense } from "@/lib/form-styles";
import {
  DEFAULT_MEAL_TIMES,
  enumerateDates,
  formatPlanDate,
  MEAL_LABEL,
  MEAL_ORDER,
  type MealType,
} from "@/lib/meal-plan";
import { DeletePlanButton } from "./delete-plan-button";
import { IngredientsModal } from "./ingredients-modal";
import { RecipePicker } from "./recipe-picker";

/** Common answers to "how long have you got?", in minutes. */
const TIME_CHOICES = [15, 30, 45, 60, 90, 120];

export function PlannerClient({ plan, origin }: { plan: PlanDetail; origin: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ slotId: string; date: string; meal: MealType } | null>(
    null,
  );
  /** The meal the ingredients popup is showing; null when it's closed. */
  const [showingIngredients, setShowingIngredients] = useState<{
    date: string;
    meal: MealType;
  } | null>(null);
  const [shareSlug, setShareSlug] = useState(plan.shareSlug);

  const dates = enumerateDates(plan.startDate, plan.endDate);
  const slotFor = (date: string, meal: MealType): PlanSlotRow | undefined =>
    plan.slots.find((s) => s.date === date && s.meal === meal);

  function run(fn: () => Promise<{ error?: string } | unknown>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string };
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function toggleMeal(date: string, meal: MealType, on: boolean) {
    run(() =>
      on
        ? upsertMealSlotAction({ planId: plan.id, date, meal })
        : removeMealSlotAction({ planId: plan.id, date, meal }),
    );
  }

  function patchSlot(slot: PlanSlotRow, patch: Partial<PlanSlotRow>) {
    run(() =>
      upsertMealSlotAction({
        planId: plan.id,
        date: slot.date,
        meal: slot.meal,
        timeAvailableMinutes: patch.timeAvailableMinutes ?? slot.timeAvailableMinutes,
        mealTime: patch.mealTime !== undefined ? patch.mealTime : slot.mealTime,
        note: patch.note !== undefined ? patch.note : slot.note,
        recipeId: patch.recipeId !== undefined ? patch.recipeId : slot.recipeId,
      }),
    );
  }

  // origin comes from the server so this string is identical in both renders.
  const shareUrl = shareSlug ? `${origin}/plan/shared/${shareSlug}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
          </p>
          <h1 className="text-3xl sm:text-4xl">{plan.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => fillPlanAction(plan.id))}
            className="btn btn-secondary !py-2 text-sm disabled:opacity-50"
            title="Suggest a recipe for every empty meal"
          >
            Fill my plan
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await setPlanSharingAction({
                  planId: plan.id,
                  enabled: !shareSlug,
                });
                if ("error" in res) {
                  setError(res.error);
                  return;
                }
                setShareSlug(res.shareSlug);
                router.refresh();
              })
            }
            className="btn btn-secondary !py-2 text-sm disabled:opacity-50"
          >
            {shareSlug ? "Stop sharing" : "Share"}
          </button>
          <DeletePlanButton planId={plan.id} planTitle={plan.title} />
        </div>
      </div>

      {shareUrl ? (
        <p className="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-ink-soft">
          Anyone with this link can see the plan, read-only:{" "}
          <a href={shareUrl} className="break-all font-medium text-terracotta hover:text-terracotta-strong">
            {shareUrl}
          </a>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {dates.map((date) => (
          <section key={date} className="rounded-2xl border border-sand bg-surface p-4 sm:p-5">
            <h2 className="mb-3 text-lg">{formatPlanDate(date)}</h2>

            <div className="grid gap-3 sm:grid-cols-3">
              {MEAL_ORDER.map((meal) => {
                const slot = slotFor(date, meal);
                const planned = Boolean(slot);
                return (
                  <div
                    key={meal}
                    // An empty meal is a prompt to fill it in, which means
                    // nothing on paper.
                    className={`rounded-xl border p-3 transition ${
                      planned
                        ? "border-sand-strong bg-[#fffdf8]"
                        : "border-dashed border-sand print:hidden"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={planned}
                        disabled={isPending}
                        onChange={(e) => toggleMeal(date, meal, e.target.checked)}
                        className="h-4 w-4 rounded border-sand-strong accent-terracotta print:hidden"
                      />
                      {MEAL_LABEL[meal]}
                    </label>

                    {slot ? (
                      <div className="mt-3 space-y-2">
                        {slot.recipeId ? (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/recipe/${slot.recipeId}`}
                                className="min-w-0 text-sm font-medium text-ink hover:text-terracotta-strong"
                              >
                                {slot.recipeTitle}
                              </Link>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => patchSlot(slot, { recipeId: null })}
                                className="shrink-0 text-xs text-ink-muted hover:text-red-700 print:hidden"
                                title="Remove this recipe"
                              >
                                ×
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowingIngredients({ date, meal })}
                              className="rounded-lg border border-sand-strong px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong print:hidden"
                            >
                              Ingredients
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPicking({ slotId: slot.id, date, meal })}
                            className="w-full rounded-lg border border-dashed border-sand-strong px-3 py-2 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta-strong print:hidden"
                          >
                            Choose a recipe
                          </button>
                        )}

                        {/* On paper the two controls below are empty boxes, so
                            print their values as a plain line instead. */}
                        <p className="hidden text-xs text-ink-soft print:block">
                          Eat at {slot.mealTime ?? DEFAULT_MEAL_TIMES[meal]}
                          {slot.timeAvailableMinutes
                            ? ` · ${slot.timeAvailableMinutes} min to cook`
                            : ""}
                        </p>

                        <div className="flex gap-2 print:hidden">
                          <label
                            className="min-w-0 flex-1 text-[0.7rem] font-medium uppercase tracking-wide text-ink-muted"
                            title="How long you've got to cook this meal. Only used to pick recipes that fit — it doesn't affect reminders."
                          >
                            Time I have
                            <select
                              value={slot.timeAvailableMinutes ?? ""}
                              disabled={isPending}
                              onChange={(e) =>
                                patchSlot(slot, {
                                  timeAvailableMinutes: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className={`mt-0.5 ${formFieldDense}`}
                            >
                              <option value="">Any</option>
                              {TIME_CHOICES.map((m) => (
                                <option key={m} value={m}>
                                  {m} min
                                </option>
                              ))}
                            </select>
                          </label>
                          <label
                            className="min-w-0 flex-1 text-[0.7rem] font-medium uppercase tracking-wide text-ink-muted"
                            title="When you want to sit down to eat. This is what the start-cooking reminder counts back from."
                          >
                            Eat at
                            <input
                              type="time"
                              defaultValue={slot.mealTime ?? DEFAULT_MEAL_TIMES[meal]}
                              disabled={isPending}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v !== (slot.mealTime ?? DEFAULT_MEAL_TIMES[meal])) {
                                  patchSlot(slot, { mealTime: v || null });
                                }
                              }}
                              className={`mt-0.5 ${formFieldDense}`}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-ink-muted print:hidden">
        &ldquo;Time I have&rdquo; only shapes which recipes get suggested. When a meal has a recipe
        and an eat-at time, Focolare works backwards through the steps and reminds you when to start
        cooking. Times are in {plan.timezone}.
      </p>

      {showingIngredients ? (
        <IngredientsModal
          planId={plan.id}
          date={showingIngredients.date}
          meal={showingIngredients.meal}
          onClose={() => setShowingIngredients(null)}
        />
      ) : null}

      {picking ? (
        <RecipePicker
          planId={plan.id}
          slotId={picking.slotId}
          date={picking.date}
          meal={picking.meal}
          onClose={() => setPicking(null)}
          onPicked={() => {
            setPicking(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
