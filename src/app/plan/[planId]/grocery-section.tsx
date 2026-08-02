"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addManualGroceryItemAction,
  regenerateGroceryListAction,
  removeGroceryItemAction,
  toggleGroceryItemAction,
  type GroceryItemRow,
} from "@/actions/grocery";
import { formField } from "@/lib/form-styles";
import { SectionHeading } from "@/components/SectionHeading";

export function GrocerySection({
  planId,
  initialItems,
}: {
  planId: string;
  initialItems: GroceryItemRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCovered, setShowCovered] = useState(false);

  const needed = items.filter((i) => !i.coveredByPantry);
  const covered = items.filter((i) => i.coveredByPantry);
  const remaining = needed.filter((i) => !i.checked).length;

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateGroceryListAction(planId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setItems(res.items);
      router.refresh();
    });
  }

  function toggle(id: string) {
    // Optimistic: ticking things off in a shop should never wait on a round trip.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
    startTransition(async () => {
      const res = await toggleGroceryItemAction(id);
      if ("error" in res) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
        setError(res.error);
      }
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
      const refreshed = await regenerateGroceryListAction(planId);
      if (!("error" in refreshed)) setItems(refreshed.items);
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
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
            className="btn btn-secondary !py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Working…" : items.length ? "Rebuild from plan" : "Build list"}
          </button>
        }
      />

      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-12 text-center">
          <p className="text-ink-soft">
            Add recipes to the plan, then build the list — ingredients you already keep in are set
            aside automatically.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-ink-muted">
            {remaining} still to buy of {needed.length}
          </p>

          <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
            {needed.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggle(item.id)}
                  aria-label={item.name}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block ${item.checked ? "text-ink-muted line-through" : "text-ink"}`}>
                    {item.name}
                  </span>
                  {item.detail ? (
                    <span className="mt-0.5 block text-xs text-ink-muted">{item.detail}</span>
                  ) : null}
                </span>
                {item.addedManually ? (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="shrink-0 text-xs text-ink-muted hover:text-red-700"
                    title="Remove"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
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

          {covered.length > 0 ? (
            <div className="rounded-2xl border border-sand bg-surface/60 px-4 py-3">
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
                    Set aside because they&apos;re in your pantry or on hand. Tick one to buy it
                    anyway.
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
