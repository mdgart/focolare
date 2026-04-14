"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRecipeAction } from "@/actions/recipes";

type StepDraft = {
  title: string;
  instruction: string;
  durationSeconds: string;
  offsetFromPrevious: string;
};

const emptyStep = (): StepDraft => ({
  title: "",
  instruction: "",
  durationSeconds: "",
  offsetFromPrevious: "0",
});

export function CreateRecipeForm(props: { categories: { id: string; label: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members">("public");
  const [taxonomyId, setTaxonomyId] = useState<string>("");
  const [ingredients, setIngredients] = useState("flour\nwater\nsalt");
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(), emptyStep()]);
  const [pending, setPending] = useState(false);

  function addStep() {
    setSteps((s) => [...s, emptyStep()]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const ing = ingredients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    const parsedSteps = steps
      .map((s, i) => ({
        title: s.title.trim(),
        instruction: s.instruction.trim(),
        durationSeconds: s.durationSeconds.trim() ? Number(s.durationSeconds) : null,
        offsetFromPrevious: i === 0 ? 0 : Number(s.offsetFromPrevious || 0),
      }))
      .filter((s) => s.title && s.instruction);
    const res = await createRecipeAction({
      title,
      description,
      visibility,
      taxonomyCategoryId: taxonomyId || null,
      ingredients: ing,
      steps: parsedSteps,
    });
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.push(`/recipe/${res.recipeId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="text-sm text-neutral-400">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-neutral-400">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "members")}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="members">Members only (demo gate)</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400">Category</label>
          <select
            value={taxonomyId}
            onChange={(e) => setTaxonomyId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm text-neutral-400">Ingredients (one per line)</label>
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-neutral-500">Steps</h2>
          <button
            type="button"
            onClick={addStep}
            className="text-xs text-amber-300 hover:underline"
          >
            Add step
          </button>
        </div>
        {steps.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-500">Step {i + 1}</div>
            <input
              placeholder="Title"
              value={s.title}
              onChange={(e) => {
                const next = [...steps];
                next[i] = { ...s, title: e.target.value };
                setSteps(next);
              }}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            />
            <textarea
              placeholder="Instruction"
              value={s.instruction}
              onChange={(e) => {
                const next = [...steps];
                next[i] = { ...s, instruction: e.target.value };
                setSteps(next);
              }}
              rows={2}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Duration (sec)"
                value={s.durationSeconds}
                onChange={(e) => {
                  const next = [...steps];
                  next[i] = { ...s, durationSeconds: e.target.value };
                  setSteps(next);
                }}
                className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
              />
              {i > 0 ? (
                <input
                  placeholder="Offset after prev (sec)"
                  value={s.offsetFromPrevious}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = { ...s, offsetFromPrevious: e.target.value };
                    setSteps(next);
                  }}
                  className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
                />
              ) : (
                <span />
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish recipe"}
      </button>
    </form>
  );
}
