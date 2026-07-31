"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  generateRecipeAction,
  getAiCreditsAction,
  parseRecipeTextAction,
  type ParsedRecipeDraft,
} from "@/actions/ai";
import { createRecipeAction, updateRecipeAction } from "@/actions/recipes";
import { ImageUploadField, type UploadedImage } from "@/components/ImageUploadField";
import { SuggestCategoryModal } from "@/components/SuggestCategoryModal";
import {
  durationPartsToSeconds,
  offsetPartsToSeconds,
  secondsToDurationParts,
} from "@/lib/format-duration";
import { formField, formFieldDense } from "@/lib/form-styles";
import { RECIPE_LANGUAGES } from "@/lib/languages";
import {
  formatIngredientLine,
  ingredientListHelp,
  ingredientListPlaceholder,
  type IngredientMeasureSystem,
  parseIngredientLine,
} from "@/lib/ingredient-measure";

type StepDraft = {
  title: string;
  instruction: string;
  durDays: string;
  durHours: string;
  durMinutes: string;
  offDays: string;
  offHours: string;
  offMinutes: string;
  image: UploadedImage | null;
};

const emptyStep = (): StepDraft => ({
  title: "",
  instruction: "",
  durDays: "",
  durHours: "",
  durMinutes: "",
  offDays: "",
  offHours: "",
  offMinutes: "0",
  image: null,
});

export type RecipeFormInitial = {
  recipeId: string;
  title: string;
  description: string;
  visibility: "public" | "private";
  taxonomyId: string;
  coverImage: UploadedImage | null;
  ingredientMeasureSystem: IngredientMeasureSystem;
  ingredients: string;
  tagsInput: string;
  language: string;
  isDraft: boolean;
  steps: StepDraft[];
};

export function CreateRecipeForm(props: {
  categories: { id: string; label: string }[];
  parentCategoryOptions: { id: string; label: string }[];
  initial?: RecipeFormInitial;
  aiEnabled?: boolean;
}) {
  const isEdit = Boolean(props.initial?.recipeId);
  const router = useRouter();
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [description, setDescription] = useState(props.initial?.description ?? "");
  const [coverImage, setCoverImage] = useState<UploadedImage | null>(props.initial?.coverImage ?? null);
  const [visibility, setVisibility] = useState<"public" | "private">(props.initial?.visibility ?? "public");
  const [taxonomyId, setTaxonomyId] = useState(
    () => props.initial?.taxonomyId ?? props.categories[0]?.id ?? "",
  );
  const [extraCategories, setExtraCategories] = useState<{ id: string; label: string }[]>(() => {
    const id = props.initial?.taxonomyId;
    if (!id) return [];
    const inList = props.categories.some((c) => c.id === id);
    if (inList) return [];
    return [{ id, label: "Current category" }];
  });
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState(props.initial?.tagsInput ?? "");
  const [language, setLanguage] = useState(props.initial?.language ?? "en");
  const [ingredientMeasureSystem, setIngredientMeasureSystem] = useState<IngredientMeasureSystem>(
    props.initial?.ingredientMeasureSystem ?? "metric",
  );
  const [ingredients, setIngredients] = useState(
    props.initial?.ingredients ?? "500 g bread flour\n375 ml water\n10 g salt",
  );
  const [steps, setSteps] = useState<StepDraft[]>(
    props.initial?.steps?.length ? props.initial.steps : [emptyStep(), emptyStep()],
  );
  const [pending, setPending] = useState<null | "draft" | "publish">(null);
  const [formError, setFormError] = useState<string | null>(null);
  /** Drafts stay unpublished; an already-published recipe keeps its state unless explicitly changed. */
  const isDraft = props.initial ? props.initial.isDraft : true;

  // --- AI import state ---
  const [aiText, setAiText] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [aiMode, setAiMode] = useState<"paste" | "invent">("paste");
  const [ideaText, setIdeaText] = useState("");
  const [servings, setServings] = useState("");
  const [constraints, setConstraints] = useState("");
  const [credits, setCredits] = useState<{
    plan: string;
    recipes: { used: number; limit: number; remaining: number };
    images: { used: number; limit: number; remaining: number };
  } | null>(null);
  const [coverPending, setCoverPending] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const mergedCategories = useMemo(() => {
    const seen = new Set(props.categories.map((c) => c.id));
    const extra = extraCategories.filter((c) => !seen.has(c.id));
    return [...props.categories, ...extra];
  }, [props.categories, extraCategories]);

  useEffect(() => {
    if (!props.aiEnabled) return;
    void getAiCreditsAction().then((c) => setCredits(c));
  }, [props.aiEnabled, aiApplied, coverImage]);

  useEffect(() => {
    if (mergedCategories.length === 0) {
      setTaxonomyId("");
      return;
    }
    if (!taxonomyId || !mergedCategories.some((c) => c.id === taxonomyId)) {
      setTaxonomyId(mergedCategories[0]!.id);
    }
  }, [mergedCategories, taxonomyId]);

  function addStep() {
    setSteps((s) => [...s, emptyStep()]);
  }

  function removeStep(index: number) {
    setSteps((s) => (s.length > 1 ? s.filter((_, i) => i !== index) : s));
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  async function runAiImport() {
    setAiError(null);
    setAiPending(true);
    try {
      const res = await parseRecipeTextAction({
        text: aiText,
        categories: mergedCategories,
      });
      if ("error" in res) {
        setAiError(res.error);
        return;
      }
      applyDraft(res.draft);
    } finally {
      setAiPending(false);
    }
  }

  async function runAiGenerate() {
    setAiError(null);
    setAiPending(true);
    try {
      const res = await generateRecipeAction({
        idea: ideaText,
        servings,
        constraints,
        categories: mergedCategories,
      });
      if ("error" in res) {
        setAiError(res.error);
        return;
      }
      applyDraft(res.draft);
    } finally {
      setAiPending(false);
    }
  }

  /** Both AI modes return the same shape, so filling the form is shared. */
  function applyDraft(d: ParsedRecipeDraft) {
      if (d.title) setTitle(d.title);
      if (d.description) setDescription(d.description);
      setIngredientMeasureSystem(d.ingredientMeasureSystem);
      if (d.ingredients.length) {
        setIngredients(
          d.ingredients
            .map((i) =>
              formatIngredientLine({ name: i.name, amount: i.amount ?? undefined, unit: i.unit ?? undefined }),
            )
            .join("\n"),
        );
      }
      if (d.tags.length) setTagsInput(d.tags.join(", "));
      if (d.language) setLanguage(d.language);
      if (d.taxonomyCategoryId && mergedCategories.some((c) => c.id === d.taxonomyCategoryId)) {
        setTaxonomyId(d.taxonomyCategoryId);
      }
      setSteps(
        d.steps.map((s, i) => {
          const dur = secondsToDurationParts(s.durationSeconds);
          const off = secondsToDurationParts(i === 0 ? 0 : s.offsetFromPrevious);
          return {
            title: s.title,
            instruction: s.instruction,
            durDays: dur.days,
            durHours: dur.hours,
            durMinutes: dur.minutes,
            offDays: off.days,
            offHours: off.hours,
            offMinutes: off.minutes || "0",
            image: null,
          };
        }),
      );
      setAiApplied(true);
  }

  async function generateCover() {
    setCoverError(null);
    setCoverPending(true);
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = (await res.json()) as { error?: string; media?: { id: string; publicUrl: string } };
      if (!res.ok || !data.media?.id) {
        setCoverError(data.error ?? "Image generation failed.");
        return;
      }
      setCoverImage({ mediaId: data.media.id, publicUrl: data.media.publicUrl });
    } catch {
      setCoverError("Network error — try again.");
    } finally {
      setCoverPending(false);
    }
  }

  async function submit(intent: "draft" | "publish") {
    setFormError(null);
    setPending(intent);
    const ing = ingredients
      .split("\n")
      .map((line) => parseIngredientLine(line))
      .filter((row) => row.name.length > 0);
    const parsedSteps = steps
      .map((s, i) => {
        const durationSeconds = durationPartsToSeconds(s.durDays, s.durHours, s.durMinutes);
        const offsetFromPrevious =
          i === 0 ? 0 : Math.max(0, offsetPartsToSeconds(s.offDays, s.offHours, s.offMinutes));
        return {
          title: s.title.trim(),
          instruction: s.instruction.trim(),
          durationSeconds,
          offsetFromPrevious,
          imageMediaId: s.image?.mediaId ?? null,
        };
      })
      .filter((s) => s.instruction.length > 0);
    const tagLabels = tagsInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const publish = intent === "publish";
    const res = isEdit
      ? await updateRecipeAction(props.initial!.recipeId, {
          title,
          description,
          visibility,
          taxonomyCategoryId: taxonomyId,
          coverMediaId: coverImage?.mediaId ?? null,
          language,
          publish,
          ingredients: ing,
          ingredientMeasureSystem,
          tags: tagLabels,
          steps: parsedSteps,
        })
      : await createRecipeAction({
          title,
          description,
          visibility,
          taxonomyCategoryId: taxonomyId,
          coverMediaId: coverImage?.mediaId ?? null,
          language,
          publish,
          ingredients: ing,
          ingredientMeasureSystem,
          tags: tagLabels,
          steps: parsedSteps,
        });
    setPending(null);
    if ("error" in res) {
      setFormError(res.error);
      return;
    }
    router.push(`/recipe/${res.recipeId}`);
  }

  const showGenerateCover = Boolean(props.aiEnabled) && !coverImage;

  return (
    <>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(isDraft ? "draft" : "publish"); }} className="space-y-6">
        {/* ---- AI import ---- */}
        {!isEdit && props.aiEnabled ? (
          <section className="rounded-3xl border border-terracotta/30 bg-terracotta-tint/40 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-[#fff8f0]">
                <SparkleIcon />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-ink">Let AI do the typing</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Start from a recipe you already have, or from whatever&apos;s in your kitchen.
                  Either way the form gets filled in and you review everything before it goes
                  anywhere.
                </p>

                <div className="mt-3 inline-flex rounded-full border border-terracotta/30 bg-white/70 p-1">
                  <AiModeTab active={aiMode === "paste"} onClick={() => setAiMode("paste")}>
                    Paste a recipe
                  </AiModeTab>
                  <AiModeTab active={aiMode === "invent"} onClick={() => setAiMode("invent")}>
                    Invent one for me
                  </AiModeTab>
                </div>

                {credits ? (
                  <p className="mt-2 text-xs text-ink-muted">
                    {credits.recipes.remaining > 0 ? (
                      <>
                        <strong className="text-ink-soft">
                          {credits.recipes.remaining} of {credits.recipes.limit}
                        </strong>{" "}
                        AI recipes left this month
                        {credits.plan === "free" ? " on the free plan" : ""}.
                      </>
                    ) : (
                      <>You&apos;ve used this month&apos;s AI recipes — they reset on the 1st.</>
                    )}
                  </p>
                ) : null}

                {aiMode === "paste" ? (
                  <>
                    <textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={5}
                      placeholder={"Paste the full recipe text here…"}
                      className={`mt-3 ${formField} bg-white/90`}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void runAiImport()}
                        disabled={aiPending || aiText.trim().length === 0}
                        className="btn btn-primary !py-2 text-sm disabled:opacity-50"
                      >
                        {aiPending ? "Structuring…" : "Structure with AI"}
                      </button>
                      {aiApplied && !aiPending ? (
                        <span className="text-sm font-medium text-sage">
                          Form filled — review and adjust below.
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <textarea
                      value={ideaText}
                      onChange={(e) => setIdeaText(e.target.value)}
                      rows={3}
                      placeholder={"What have you got? e.g. chicken thighs, a lemon, half a bag of rice — or just \u201csomething warming with lentils\u201d"}
                      className={`mt-3 ${formField} bg-white/90`}
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-ink-soft">
                        Servings (optional)
                        <input
                          value={servings}
                          onChange={(e) => setServings(e.target.value)}
                          placeholder="e.g. 4"
                          className={`mt-1 ${formFieldDense} bg-white/90`}
                        />
                      </label>
                      <label className="block text-xs font-medium text-ink-soft">
                        Anything else? (optional)
                        <input
                          value={constraints}
                          onChange={(e) => setConstraints(e.target.value)}
                          placeholder="under 30 min, vegetarian, one pan…"
                          className={`mt-1 ${formFieldDense} bg-white/90`}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void runAiGenerate()}
                        disabled={aiPending || ideaText.trim().length < 3}
                        className="btn btn-primary !py-2 text-sm disabled:opacity-50"
                      >
                        {aiPending ? "Cooking up a recipe…" : "Create a recipe"}
                      </button>
                      {aiApplied && !aiPending ? (
                        <span className="text-sm font-medium text-sage">
                          Form filled — review and adjust below.
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      AI-written recipes are a starting point — check amounts and times before you
                      trust them, and keep it a draft until you&apos;ve cooked it.
                    </p>
                  </>
                )}

                {aiError ? <p className="mt-2 text-sm font-medium text-red-700">{aiError}</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        {mergedCategories.length === 0 ? (
          <p className="rounded-2xl border border-terracotta/40 bg-terracotta-tint/60 px-4 py-3 text-sm text-ink">
            No categories are available yet. Use{" "}
            <button
              type="button"
              onClick={() => setSuggestOpen(true)}
              className="font-semibold text-terracotta-strong underline hover:text-terracotta"
            >
              Suggest a category
            </button>{" "}
            to add one you can use on this recipe immediately (still pending admin approval for Discover).
          </p>
        ) : null}

        {/* ---- Basics ---- */}
        <FormSection eyebrow="The dish" title="Basics">
          <div>
            <label htmlFor="recipe-title" className="text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="recipe-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Overnight country loaf"
              className={`mt-1.5 ${formField} text-base`}
            />
          </div>
          <div>
            <label htmlFor="recipe-description" className="text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="recipe-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A sentence or two that makes people want to cook it."
              className={`mt-1.5 ${formField}`}
            />
          </div>
          <div className="space-y-2">
            <ImageUploadField label="Cover photo (optional)" value={coverImage} onChange={setCoverImage} optional />
            {showGenerateCover ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void generateCover()}
                  disabled={coverPending || !title.trim()}
                  className="inline-flex items-center gap-2 rounded-full border border-terracotta/50 bg-terracotta-tint px-4 py-2 text-sm font-semibold text-terracotta-strong transition hover:bg-[#f0d9c4] disabled:opacity-50"
                >
                  <SparkleIcon className="h-4 w-4" />
                  {coverPending ? "Generating photo… (~20s)" : "Generate a photo with AI"}
                </button>
                {!title.trim() ? (
                  <span className="text-xs text-ink-muted">Add a title first.</span>
                ) : credits ? (
                  <span className="text-xs text-ink-muted">
                    {credits.images.remaining} of {credits.images.limit} AI photos left this month
                  </span>
                ) : null}
              </div>
            ) : null}
            {coverError ? <p className="text-sm font-medium text-red-700">{coverError}</p> : null}
          </div>
        </FormSection>

        {/* ---- Publishing ---- */}
        <FormSection eyebrow="Where it lives" title="Publishing">
          <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
            <div className="flex min-w-0 flex-col">
              <label htmlFor="recipe-visibility" className="text-sm font-medium text-ink">
                Visibility
              </label>
              <select
                id="recipe-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                className={`mt-1.5 min-h-[2.75rem] ${formField}`}
              >
                <option value="public">Public — anyone can find it</option>
                <option value="private">Private — just for me</option>
              </select>
              <p className="mt-1.5 text-xs leading-snug text-ink-muted">
                <strong className="text-ink-soft">Public</strong> — listed in Discover and on your channel.{" "}
                <strong className="text-ink-soft">Private</strong> — hidden from everyone else, so
                you can build your own cookbook. You can still cook it with timers.
              </p>
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <label htmlFor="recipe-category" className="text-sm font-medium text-ink">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setSuggestOpen(true)}
                  className="shrink-0 text-xs font-semibold text-terracotta underline decoration-terracotta/40 hover:text-terracotta-strong"
                >
                  Suggest new
                </button>
              </div>
              <select
                id="recipe-category"
                required
                value={taxonomyId}
                onChange={(e) => setTaxonomyId(e.target.value)}
                disabled={mergedCategories.length === 0}
                className={`mt-1.5 min-h-[2.75rem] ${formField}`}
              >
                {mergedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="recipe-tags" className="text-sm font-medium text-ink">
              Tags <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="recipe-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. sourdough, weekend, dutch-oven"
              className={`mt-1.5 ${formField}`}
            />
            <p className="mt-1.5 text-xs text-ink-muted">Comma-separated. Used for search and the tag cloud.</p>
          </div>
          <div>
            <label htmlFor="recipe-language" className="text-sm font-medium text-ink">
              Language
            </label>
            <select
              id="recipe-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`mt-1.5 min-h-[2.75rem] max-w-xs ${formField}`}
            >
              {RECIPE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-muted">
              Write in whichever language you think in — readers get a one-tap translation.
            </p>
          </div>
        </FormSection>

        {/* ---- Ingredients ---- */}
        <FormSection eyebrow="What you need" title="Ingredients">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Amounts</legend>
            <div className="mt-2 inline-flex rounded-full border border-sand-strong bg-sunken p-1">
              <MeasureToggle
                active={ingredientMeasureSystem === "metric"}
                onClick={() => setIngredientMeasureSystem("metric")}
                label="Metric"
                hint="g, kg, ml, L"
              />
              <MeasureToggle
                active={ingredientMeasureSystem === "us"}
                onClick={() => setIngredientMeasureSystem("us")}
                label="US volumetric"
                hint="cups, tbsp, tsp"
              />
            </div>
          </fieldset>
          <div>
            <label htmlFor="recipe-ingredients" className="text-sm font-medium text-ink">
              One ingredient per line
            </label>
            <textarea
              id="recipe-ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={7}
              placeholder={ingredientListPlaceholder(ingredientMeasureSystem)}
              className={`mt-1.5 font-mono text-[0.85rem] ${formField}`}
            />
            <p className="mt-1.5 text-xs text-ink-muted">{ingredientListHelp(ingredientMeasureSystem)}</p>
          </div>
        </FormSection>

        {/* ---- Steps ---- */}
        <FormSection
          eyebrow="The method"
          title="Steps"
          aside={
            <button type="button" onClick={addStep} className="btn btn-secondary !py-2 text-sm">
              + Add step
            </button>
          }
        >
          <p className="-mt-2 text-xs text-ink-muted">
            Durations power cook-mode timers. Waits model idle gaps (proofing, chilling) before a step
            starts.
          </p>
          {steps.map((s, i) => (
            <div key={i} className="rounded-2xl border border-sand bg-[#fffdf8] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta-tint font-display text-sm font-semibold text-terracotta-strong">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  className="text-xs font-medium text-ink-muted transition hover:text-red-700 disabled:invisible"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="Step title (optional) — e.g. Bulk ferment"
                  value={s.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  className={formFieldDense}
                />
                <textarea
                  placeholder="What to do in this step…"
                  value={s.instruction}
                  onChange={(e) => updateStep(i, { instruction: e.target.value })}
                  rows={2}
                  className={formFieldDense}
                />
                <ImageUploadField
                  label="Step photo (optional)"
                  value={s.image}
                  optional
                  onChange={(img) => updateStep(i, { image: img })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DurationFields
                    legend="Step duration (optional)"
                    days={s.durDays}
                    hours={s.durHours}
                    minutes={s.durMinutes}
                    onChange={(p) =>
                      updateStep(i, { durDays: p.days, durHours: p.hours, durMinutes: p.minutes })
                    }
                  />
                  {i > 0 ? (
                    <DurationFields
                      legend="Wait after previous step (optional)"
                      days={s.offDays}
                      hours={s.offHours}
                      minutes={s.offMinutes}
                      onChange={(p) =>
                        updateStep(i, { offDays: p.days, offHours: p.hours, offMinutes: p.minutes })
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addStep} className="btn btn-secondary w-full">
            + Add another step
          </button>
        </FormSection>

        {formError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => void submit("publish")}
            disabled={pending !== null || mergedCategories.length === 0}
            className="btn btn-primary flex-1 text-base disabled:opacity-50"
          >
            {pending === "publish"
              ? "Publishing…"
              : isDraft
                ? "Publish recipe"
                : "Save & keep published"}
          </button>
          <button
            type="button"
            onClick={() => void submit("draft")}
            disabled={pending !== null || mergedCategories.length === 0}
            className="btn btn-secondary flex-1 text-base disabled:opacity-50"
          >
            {pending === "draft" ? "Saving…" : isDraft ? "Save as draft" : "Unpublish & save draft"}
          </button>
        </div>
        <p className="-mt-2 text-center text-xs text-ink-muted">
          Drafts are visible only to you — nothing is shared until you publish.
        </p>
      </form>
      <SuggestCategoryModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        parentCategoryOptions={props.parentCategoryOptions}
        onCreated={(row) => {
          setExtraCategories((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row]));
          setTaxonomyId(row.id);
        }}
      />
    </>
  );
}

function FormSection(props: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-3xl border border-sand bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            {props.eyebrow}
          </p>
          <h2 className="mt-1 text-xl">{props.title}</h2>
        </div>
        {props.aside ?? null}
      </div>
      {props.children}
    </section>
  );
}

function AiModeTab(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        props.active
          ? "bg-terracotta text-[#fff8f0]"
          : "text-terracotta-strong hover:bg-terracotta-tint"
      }`}
    >
      {props.children}
    </button>
  );
}

function MeasureToggle(props: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        props.active ? "bg-surface text-ink shadow-sm ring-1 ring-sand-strong" : "text-ink-muted hover:text-ink"
      }`}
    >
      {props.label} <span className="hidden text-xs font-normal text-ink-muted sm:inline">· {props.hint}</span>
    </button>
  );
}

function DurationFields(props: {
  legend: string;
  days: string;
  hours: string;
  minutes: string;
  onChange: (parts: { days: string; hours: string; minutes: string }) => void;
}) {
  const { days, hours, minutes } = props;
  return (
    <fieldset className="rounded-xl border border-dashed border-sand-strong bg-white/70 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {props.legend}
      </legend>
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            ["Days", days, (v: string) => props.onChange({ days: v, hours, minutes })],
            ["Hours", hours, (v: string) => props.onChange({ days, hours: v, minutes })],
            ["Minutes", minutes, (v: string) => props.onChange({ days, hours, minutes: v })],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="block">
            <span className="text-xs font-medium text-ink-soft">{label}</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`mt-0.5 ${formFieldDense}`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 2l1.7 4.6L16.3 8.3l-4.6 1.7L10 14.6 8.3 10 3.7 8.3 8.3 6.6 10 2z" />
      <path d="M15.8 12.4l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" opacity="0.75" />
    </svg>
  );
}
