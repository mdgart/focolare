import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyMealPlans } from "@/actions/meal-plans";
import { formatPlanDate, planDayCount } from "@/lib/meal-plan";
import { getServerSession } from "@/lib/session";
import { NewPlanForm } from "./new-plan-form";

export const metadata = { title: "Meal plans · Focolare" };

export default async function MealPlansPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in?next=/plan");

  const plans = await listMyMealPlans();

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-8">
      <div className="pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Your kitchen
        </p>
        <h1 className="text-3xl sm:text-4xl">Meal plans</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Plan a few days or a whole week. Focolare suggests recipes that fit the time you have and
          what&apos;s already in your cupboard, then turns the week into one shopping list.
        </p>
      </div>

      <NewPlanForm
        existing={plans.map((p) => ({
          title: p.title,
          startDate: p.startDate,
          endDate: p.endDate,
        }))}
      />

      {plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-14 text-center">
          <p className="text-ink-soft">No plans yet — start one above.</p>
        </div>
      ) : (
        <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/plan/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-sunken"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{p.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">
                    {formatPlanDate(p.startDate)} – {formatPlanDate(p.endDate)} ·{" "}
                    {planDayCount(p.startDate, p.endDate)} days · {p.plannedMeals}{" "}
                    {p.plannedMeals === 1 ? "meal" : "meals"} planned
                  </span>
                </span>
                {p.shareSlug ? (
                  <span className="shrink-0 rounded-full bg-terracotta-tint px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-terracotta-strong">
                    Shared
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted">
        Shopping lists skip what you always keep in.{" "}
        <Link href="/pantry" className="font-medium text-terracotta hover:text-terracotta-strong">
          Set up your pantry →
        </Link>
      </p>
    </div>
  );
}
