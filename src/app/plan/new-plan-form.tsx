"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMealPlanAction } from "@/actions/meal-plans";
import { formField } from "@/lib/form-styles";
import { todayInZone } from "@/lib/meal-plan";

/** The browser is the only place that knows the cook's timezone; capture it at creation. */
export function NewPlanForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const timeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [startDate, setStartDate] = useState(() => todayInZone(timeZone));
  const [days, setDays] = useState(7);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createMealPlanAction({ startDate, days, timezone: timeZone });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/plan/${res.planId}`);
    });
  }

  return (
    <div className="rounded-2xl border border-sand bg-surface p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-ink">
          Starting
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`mt-1.5 ${formField}`}
          />
        </label>
        <label className="text-sm font-medium text-ink">
          For
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={`mt-1.5 ${formField}`}
          >
            {[3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="btn btn-primary !py-2.5 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Start a plan"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">Times are handled in {timeZone}.</p>
      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
