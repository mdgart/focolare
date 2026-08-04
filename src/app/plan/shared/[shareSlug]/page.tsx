import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedPlan } from "@/actions/meal-plans";
import { formatPlanDate, MEAL_LABEL, MEAL_ORDER, type MealType } from "@/lib/meal-plan";
import { recipeHref } from "@/lib/recipe-url";

/** A shared plan is a private link, not public content — keep it out of search. */
export const metadata = {
  title: "Shared meal plan · Focolare",
  robots: { index: false, follow: false },
};

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ shareSlug: string }>;
}) {
  const { shareSlug } = await params;
  const plan = await getSharedPlan(shareSlug);
  if (!plan) notFound();

  const dates = [...new Set(plan.slots.map((s) => s.date))].sort();

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-10">
      <div className="pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Shared meal plan
        </p>
        <h1 className="text-3xl sm:text-4xl">{plan.title}</h1>
        <p className="mt-3 text-ink-soft">
          {formatPlanDate(plan.startDate)} – {formatPlanDate(plan.endDate)}
        </p>
      </div>

      {dates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-14 text-center">
          <p className="text-ink-soft">Nothing planned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <section key={date} className="rounded-2xl border border-sand bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-lg">{formatPlanDate(date)}</h2>
              <ul className="space-y-2">
                {MEAL_ORDER.map((meal) => {
                  const slot = plan.slots.find((s) => s.date === date && s.meal === meal);
                  if (!slot) return null;
                  return (
                    <li key={meal} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {MEAL_LABEL[meal as MealType]}
                      </span>
                      {slot.recipeId ? (
                        <Link
                          href={recipeHref({
                            recipeId: slot.recipeId,
                            channelSlug: slot.channelSlug,
                            recipeSlug: slot.recipeSlug,
                          })}
                          className="font-medium text-ink hover:text-terracotta-strong"
                        >
                          {slot.recipeTitle}
                        </Link>
                      ) : slot.hasPrivateRecipe ? (
                        // Never leak the title of a recipe the viewer couldn't open.
                        <span className="italic text-ink-muted">A private recipe</span>
                      ) : (
                        <span className="text-ink-muted">Not decided yet</span>
                      )}
                      {slot.mealTime ? (
                        <span className="text-xs text-ink-muted">at {slot.mealTime}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {plan.groceries.length > 0 ? (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            What to buy
          </p>
          <h2 className="mb-4 text-2xl">Shopping list</h2>
          <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
            {plan.groceries.map((g, i) => (
              <li key={`${g.name}-${i}`} className="px-4 py-3">
                <span className={g.checked ? "text-ink-muted line-through" : "text-ink"}>
                  {g.name}
                </span>
                {g.detail ? (
                  <span className="mt-0.5 block text-xs text-ink-muted">{g.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="border-t border-sand pt-6 text-center text-sm text-ink-muted">
        Planned with{" "}
        <Link href="/" className="font-medium text-terracotta hover:text-terracotta-strong">
          Focolare
        </Link>
      </p>
    </div>
  );
}
