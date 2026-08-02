import type { GroceryItemRow } from "@/actions/grocery";
import type { PlanDetail } from "@/actions/meal-plans";
import { alsoNeededLabel, groupByFirstDayNeeded } from "@/lib/grocery";
import {
  enumerateDates,
  formatPlanDate,
  MEAL_LABEL,
  MEAL_ORDER,
  mealTimeOrDefault,
} from "@/lib/meal-plan";

/**
 * The plan as a sheet of paper.
 *
 * A separate render rather than a print stylesheet over the planner. The screen
 * version is built out of controls — selects, toggles, tap targets — and a
 * stylesheet can only hide those, which leaves a page of big empty cards with
 * the odd word in them. What a printed plan is actually for is different too:
 * pinning to a fridge and shopping from, so it wants small type, two columns,
 * and tick boxes.
 *
 * Screen-hidden, print-visible, so it costs nothing until someone prints.
 */
export function PlanPrintSheet({
  plan,
  groceries,
}: {
  plan: PlanDetail;
  groceries: GroceryItemRow[];
}) {
  const days = enumerateDates(plan.startDate, plan.endDate)
    .map((date) => ({
      date,
      meals: plan.slots
        .filter((s) => s.date === date && s.recipeId)
        .sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal)),
    }))
    .filter((d) => d.meals.length > 0);

  const needed = groceries.filter((i) => !i.coveredByPantry);
  const groups = groupByFirstDayNeeded(needed);

  return (
    <div className="hidden text-[10pt] leading-snug text-black print:block">
      <header className="mb-4 border-b border-neutral-400 pb-2">
        <h1 className="font-display text-[18pt] leading-tight">{plan.title}</h1>
        <p className="text-[9pt] text-neutral-600">
          {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
          {days.length > 0
            ? ` · ${days.reduce((n, d) => n + d.meals.length, 0)} meals planned`
            : ""}
        </p>
      </header>

      {days.length === 0 ? (
        <p className="text-neutral-600">No meals planned yet.</p>
      ) : (
        <section className="mb-6">
          <h2 className="mb-2 text-[11pt] font-semibold uppercase tracking-wide">The week</h2>
          <div className="gap-x-8 [column-count:2]">
            {days.map((day) => (
              <div key={day.date} className="mb-3 break-inside-avoid">
                <p className="font-semibold">{formatPlanDate(day.date)}</p>
                <ul>
                  {day.meals.map((slot) => (
                    <li key={slot.meal} className="flex gap-2">
                      <span className="w-[4.5rem] shrink-0 text-neutral-600">
                        {MEAL_LABEL[slot.meal]}
                      </span>
                      <span className="w-[3.2rem] shrink-0 tabular-nums text-neutral-600">
                        {mealTimeOrDefault(slot.meal, slot.mealTime)}
                      </span>
                      <span className="min-w-0">{slot.recipeTitle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {needed.length > 0 ? (
        <section className="break-before-auto">
          <h2 className="mb-2 text-[11pt] font-semibold uppercase tracking-wide">
            Shopping list
            <span className="ml-2 font-normal text-neutral-600">
              {needed.length} {needed.length === 1 ? "thing" : "things"}
            </span>
          </h2>
          <div className="gap-x-8 [column-count:2]">
            {groups.map((group) => (
              <div key={group.date ?? "undated"} className="mb-3 break-inside-avoid">
                <p className="font-semibold text-neutral-700">
                  {group.date ? `For ${formatPlanDate(group.date)}` : "Anything else"}
                </p>
                <ul>
                  {group.items.map((item) => {
                    const also = alsoNeededLabel(item.neededOn);
                    return (
                      <li key={item.id} className="flex gap-2 break-inside-avoid py-[1px]">
                        {/* A drawn box, not a checkbox input: this gets ticked with a pen. */}
                        <span
                          aria-hidden="true"
                          className="mt-[2px] h-[9pt] w-[9pt] shrink-0 border border-neutral-500"
                        />
                        <span className="min-w-0">
                          {item.name}
                          {item.detail ? (
                            <span className="text-neutral-600"> — {item.detail}</span>
                          ) : null}
                          {also ? <span className="text-neutral-500"> ({also})</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
