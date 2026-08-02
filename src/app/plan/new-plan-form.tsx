"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createMealPlanAction } from "@/actions/meal-plans";
import { formField } from "@/lib/form-styles";
import {
  addDays,
  daysAvailableFrom,
  findOverlap,
  firstFreeDate,
  formatPlanDate,
  todayInZone,
  type DateRange,
} from "@/lib/meal-plan";

const LENGTH_CHOICES = [3, 5, 7, 14];

/**
 * Starting a plan.
 *
 * Days already covered by another plan are steered around rather than merely
 * rejected: the start date defaults to the first free day, and the length
 * options shrink to what actually fits before the next plan begins. The server
 * enforces the same rule, so a stale page can't slip an overlap through.
 *
 * The browser is also the only place that knows the cook's timezone, so it is
 * captured here at creation.
 */
export function NewPlanForm({ existing }: { existing: (DateRange & { title: string })[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const timeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const today = todayInZone(timeZone);
  const [startDate, setStartDate] = useState(() => firstFreeDate(today, existing));

  // How long a plan starting here may run before it would hit the next one.
  const maxDays = useMemo(() => daysAvailableFrom(startDate, existing), [startDate, existing]);
  const presets = LENGTH_CHOICES.filter((d) => d <= maxDays);
  // When the gap is shorter than every preset, offer exactly the gap.
  const options = presets.length > 0 ? presets : maxDays > 0 ? [maxDays] : [];

  const [days, setDays] = useState(7);
  const effectiveDays = options.includes(days) ? days : (options[options.length - 1] ?? 0);

  const startClash = findOverlap({ startDate, endDate: startDate }, existing);
  const nextFree = firstFreeDate(startDate, existing);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createMealPlanAction({
        startDate,
        days: effectiveDays,
        timezone: timeZone,
      });
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
            min={today}
            onChange={(e) => {
              setError(null);
              setStartDate(e.target.value);
            }}
            className={`mt-1.5 ${formField}`}
          />
        </label>
        <label className="text-sm font-medium text-ink">
          For
          <select
            value={effectiveDays}
            disabled={options.length === 0}
            onChange={(e) => setDays(Number(e.target.value))}
            className={`mt-1.5 ${formField}`}
          >
            {options.length === 0 ? (
              <option value={0}>—</option>
            ) : (
              options.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "day" : "days"}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || options.length === 0}
          className="btn btn-primary !py-2.5 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Start a plan"}
        </button>
      </div>

      {startClash ? (
        <p className="mt-3 text-sm text-ink-soft">
          <strong className="text-ink">{formatPlanDate(startDate)}</strong> is already part of{" "}
          <strong className="text-ink">{startClash.title}</strong>.{" "}
          <button
            type="button"
            onClick={() => setStartDate(nextFree)}
            className="font-medium text-terracotta underline hover:text-terracotta-strong"
          >
            Start on {formatPlanDate(nextFree)} instead
          </button>
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">
          {maxDays > 0 && maxDays < 31
            ? `Up to ${maxDays} ${maxDays === 1 ? "day" : "days"} free before your next plan. `
            : ""}
          {effectiveDays > 0
            ? `Ends ${formatPlanDate(addDays(startDate, effectiveDays - 1))}. `
            : ""}
          Times are handled in {timeZone}.
        </p>
      )}

      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
