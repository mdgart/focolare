"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import {
  addManualGroceryItemAction,
  keepGroceryItemAsStapleAction,
  regenerateGroceryListAction,
  removeGroceryItemAction,
  toggleGroceryItemAction,
  type GroceryItemRow,
} from "@/actions/grocery";
import { formField } from "@/lib/form-styles";
import { alsoNeededLabel, groupByFirstDayNeeded } from "@/lib/grocery";
import { formatPlanDate } from "@/lib/meal-plan";
import { SectionHeading } from "@/components/SectionHeading";

export function GrocerySection({
  planId,
  initialItems,
}: {
  planId: string;
  initialItems: GroceryItemRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCovered, setShowCovered] = useState(false);

  /**
   * The server is the authority, so adding or removing a recipe upstream shows
   * up here as soon as the page re-renders — no local mirror to go stale.
   *
   * Ticking off is the one thing that can't wait on a round trip, so it's an
   * optimistic layer on top. React re-applies any still-pending ticks over
   * incoming server data, which a local copy of the list could not do: a
   * refresh landing mid-tap would have snapped the tick back.
   */
  const [items, toggleOptimistic] = useOptimistic(
    initialItems,
    (current: GroceryItemRow[], toggledId: string) =>
      current.map((i) => (i.id === toggledId ? { ...i, checked: !i.checked } : i)),
  );

  const needed = items.filter((i) => !i.coveredByPantry);
  const covered = items.filter((i) => i.coveredByPantry);
  const remaining = needed.filter((i) => !i.checked).length;
  const groups = groupByFirstDayNeeded(needed);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateGroceryListAction(planId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function toggle(id: string) {
    startTransition(async () => {
      // Ticking things off in a shop should never wait on a round trip. If the
      // write fails the optimistic layer drops with the transition, putting the
      // tick back on its own.
      toggleOptimistic(id);
      const res = await toggleGroceryItemAction(id);
      if ("error" in res) setError(res.error);
    });
  }

  function addManual() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    startTransition(async () => {
      const res = await addManualGroceryItemAction({ planId, name });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function keepAsStaple(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await keepGroceryItemAsStapleAction({ planId, itemId: id });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeGroceryItemAction(id);
      router.refresh();
    });
  }

  return (
    <section>
      <SectionHeading
        eyebrow="What to buy"
        title="Shopping list"
        aside={
          <button
            type="button"
            onClick={regenerate}
            disabled={isPending}
            className="btn btn-secondary !py-2 text-sm disabled:opacity-50 print:hidden"
          >
            {isPending ? "Working…" : items.length ? "Rebuild from plan" : "Build list"}
          </button>
        }
      />

      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-12 text-center">
          <p className="text-ink-soft">
            Choose a recipe for a meal above and its ingredients land here — the ones you already
            keep in are set aside automatically.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-ink-muted">
            {remaining} still to buy of {needed.length}
            {groups.length > 1 ? " · grouped by the first day you need it" : ""}
          </p>

          {groups.map((group) => (
            <div key={group.date ?? "undated"}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                {group.date ? `For ${formatPlanDate(group.date)}` : "Anything else"}
              </p>
              <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
                {group.items.map((item) => {
                  const also = alsoNeededLabel(item.neededOn);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggle(item.id)}
                        aria-label={item.name}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block ${item.checked ? "text-ink-muted line-through" : "text-ink"}`}
                        >
                          {item.name}
                        </span>
                        {item.detail ? (
                          <span className="mt-0.5 block text-xs text-ink-muted">{item.detail}</span>
                        ) : null}
                        {also ? (
                          <span className="mt-0.5 block text-[0.7rem] text-ink-muted">{also}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => keepAsStaple(item.id)}
                        disabled={isPending}
                        className="shrink-0 whitespace-nowrap text-xs text-ink-muted transition hover:text-terracotta-strong disabled:opacity-50 print:hidden"
                        title={`I always have ${item.name} — add it to my staples and set it aside on every list from now on`}
                      >
                        add to staples
                      </button>
                      {item.addedManually ? (
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          className="shrink-0 text-xs text-ink-muted hover:text-red-700 print:hidden"
                          title="Remove"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="flex gap-2 print:hidden">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManual();
                }
              }}
              placeholder="Add something else…"
              className={`${formField} flex-1`}
            />
            <button
              type="button"
              onClick={addManual}
              disabled={isPending || !draft.trim()}
              className="btn btn-secondary shrink-0 !px-5 !py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* Things you already have aren't shopping — no reason to print them. */}
          {covered.length > 0 ? (
            <div className="rounded-2xl border border-sand bg-surface/60 px-4 py-3 print:hidden">
              <button
                type="button"
                onClick={() => setShowCovered((v) => !v)}
                className="text-sm font-medium text-ink-soft hover:text-ink"
              >
                {showCovered ? "Hide" : "Show"} {covered.length} you already have
              </button>
              {showCovered ? (
                <>
                  <p className="mt-2 text-xs text-ink-muted">
                    Set aside because you already have them — pantry staples, things on hand, or
                    basics like tap water. Tick one to buy it anyway.
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {covered.map((item) => (
                      <li key={item.id}>
                        <span className="inline-flex items-center gap-2 rounded-full border border-sand-strong bg-surface px-3 py-1.5 text-sm text-ink-soft">
                          {item.name}
                          <button
                            type="button"
                            onClick={() => toggle(item.id)}
                            className="text-xs text-ink-muted hover:text-terracotta-strong"
                            title="Buy this anyway"
                          >
                            + buy
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
