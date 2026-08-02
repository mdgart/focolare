"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPantryStaplesAction, removePantryStapleAction, type StapleRow } from "@/actions/pantry";
import { CURATED_STAPLES } from "@/lib/curated-staples";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { formField } from "@/lib/form-styles";

export function PantryClient({ staples }: { staples: StapleRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Curated items already in the pantry are shown as done, not offered again.
  const have = new Set(staples.map((s) => normalizeIngredientName(s.name)));

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

  function addTyped() {
    const names = draft
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setDraft("");
    run(() => addPantryStaplesAction(names));
  }

  function addPicked() {
    if (picked.size === 0) return;
    const names = [...picked];
    setPicked(new Set());
    run(() => addPantryStaplesAction(names));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-sand bg-surface p-5">
        <h2 className="text-lg">What you keep in</h2>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTyped();
              }
            }}
            placeholder="Salt, olive oil, eggs…"
            className={`${formField} flex-1`}
          />
          <button
            type="button"
            onClick={addTyped}
            disabled={isPending || !draft.trim()}
            className="btn btn-primary shrink-0 !px-5 !py-2 text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-ink-muted">Separate several with commas.</p>

        {staples.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-strong bg-sunken/50 px-4 py-6 text-center text-sm text-ink-muted">
            Nothing yet. Add a few below and every shopping list gets shorter.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {staples.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => removePantryStapleAction(s.id))}
                  title={`Remove ${s.name}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-red-300 hover:text-red-800 disabled:opacity-50"
                >
                  {s.name}
                  <span aria-hidden="true" className="text-ink-muted group-hover:text-red-700">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-sand bg-surface p-5">
        <div>
          <h2 className="text-lg">Common staples</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Tick the ones you keep — quicker than typing them out.
          </p>
        </div>

        {CURATED_STAPLES.map((group) => (
          <div key={group.group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
              {group.group}
            </p>
            <ul className="flex flex-wrap gap-2">
              {group.items.map((item) => {
                const already = have.has(normalizeIngredientName(item));
                const isPicked = picked.has(item);
                return (
                  <li key={item}>
                    <button
                      type="button"
                      disabled={already || isPending}
                      onClick={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(item)) next.delete(item);
                          else next.add(item);
                          return next;
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        already
                          ? "cursor-default border-sand bg-sunken text-ink-muted"
                          : isPicked
                            ? "border-transparent bg-terracotta text-[#fff8f0]"
                            : "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
                      }`}
                    >
                      {item}
                      {already ? " ✓" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {picked.size > 0 ? (
          <button
            type="button"
            onClick={addPicked}
            disabled={isPending}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {isPending ? "Adding…" : `Add ${picked.size} to my pantry`}
          </button>
        ) : null}
      </section>
    </div>
  );
}
