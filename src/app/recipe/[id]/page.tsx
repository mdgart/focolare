import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getRecipeBundle } from "@/actions/recipes";
import { isRecipeSaved } from "@/actions/saved";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { canViewRecipe } from "@/lib/recipe-access";
import { humanDurationSeconds } from "@/lib/format-duration";
import { effectiveStepSeconds, totalRecipeSeconds } from "@/lib/infer-duration";
import { ingredientSystemTitle } from "@/lib/ingredient-measure";
import { RecipePrintButton } from "@/components/RecipePrintButton";
import { CreatorProfileBar } from "@/components/CreatorProfileBar";
import { SaveRecipeButton } from "@/components/SaveRecipeButton";
import { TranslateRecipeButton } from "@/components/TranslateRecipeButton";
import { languageLabel } from "@/lib/languages";
import { getChannelFollowerCount, getChannelAvatarPublicUrl, isUserFollowingChannel } from "@/actions/channels";
import { getServerSession } from "@/lib/session";
import { db } from "@/db";
import { channel } from "@/db/schema";
import type { StepInput } from "@/lib/cook-schedule";
import { DeleteRecipeButton } from "./delete-recipe-button";
import { PublishRecipeButton } from "./publish-button";
import { StartCookForm } from "./start-cook-form";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const access = await canViewRecipe({ userId: session?.user?.id ?? null, recipeId: id });
  const bundle = await getRecipeBundle(id);
  if (!bundle) notFound();
  const { recipe: r, steps, coverPublicUrl, coverAttribution, tags } = bundle;

  const [ch] = await db.select().from(channel).where(eq(channel.id, r.channelId)).limit(1);
  if (!ch) notFound();

  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-xl space-y-5 pt-10 text-center">
        <h1 className="text-3xl">{r.title}</h1>
        <p className="rounded-2xl border border-sand bg-surface px-5 py-4 text-sm text-ink-soft">
          This recipe is <strong className="text-ink">private</strong>. Only the channel owner can
          view it. If this is your recipe, sign in with the account you used to publish it.
        </p>
        <Link
          href={`/c/${ch.slug}`}
          className="inline-block font-medium text-terracotta hover:text-terracotta-strong"
        >
          View {ch.title} →
        </Link>
      </div>
    );
  }

  const user = session?.user;
  const canDeleteRecipe = Boolean(
    user && (ch.ownerUserId === user.id || (await isAdminSessionUser(user))),
  );
  const isOwner = Boolean(user && ch.ownerUserId === user.id);
  const isDraft = r.publishedAt === null;
  const [followerCount, following, avatarPublicUrl, saved] = await Promise.all([
    getChannelFollowerCount(ch.id),
    isUserFollowingChannel(user?.id ?? null, ch.id),
    getChannelAvatarPublicUrl(ch.avatarMediaId),
    isRecipeSaved(id),
  ]);

  // Where a cook wrote the timing in prose but left the duration field empty,
  // read it back out of the text — otherwise the planner treats the step as
  // instant and reports "start 12:30, ready 12:30".
  const cookStepInputs: StepInput[] = steps.map((s) => ({
    position: s.position,
    title: s.title,
    durationSeconds: effectiveStepSeconds(s).seconds || null,
    offsetFromPrevious: s.offsetFromPrevious,
  }));

  const totalTime = totalRecipeSeconds(steps);
  const totalDurationSeconds = totalTime.seconds;
  const totalDurationLabel = humanDurationSeconds(totalDurationSeconds);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const recipePageUrl = host ? `${proto}://${host}/recipe/${id}` : "";

  return (
    <article className="recipe-print-root mx-auto max-w-6xl print:max-w-none">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 print:block">
        {/* ---- Main column ---- */}
        <div className="min-w-0 space-y-10">
          {/* Header */}
          <header className="pt-2 sm:pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {isDraft && (
                  <span className="rounded-full border border-terracotta/50 bg-terracotta-tint px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terracotta-strong">
                    Draft
                  </span>
                )}
                {r.visibility === "private" && (
                  <span className="rounded-full border border-sand-strong bg-sunken px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Private
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SaveRecipeButton
                  recipeId={id}
                  initialSaved={saved}
                  isLoggedIn={Boolean(user)}
                  signInHref={`/sign-in?next=/recipe/${id}`}
                />
                <RecipePrintButton />
                {canDeleteRecipe ? (
                  <>
                    <PublishRecipeButton recipeId={id} published={!isDraft} />
                    <Link
                      href={`/recipe/${id}/edit`}
                      className="rounded-full border border-sand-strong bg-surface px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
                    >
                      Edit
                    </Link>
                    <DeleteRecipeButton recipeId={id} />
                  </>
                ) : null}
              </div>
            </div>

            {isDraft && (isOwner || canDeleteRecipe) ? (
              <div className="mb-5 rounded-2xl border border-sand-strong bg-sunken px-5 py-4 print:hidden">
                <p className="text-sm font-semibold text-ink">This is a draft</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Only you can see it. It stays out of Discover, search, and your channel until you
                  publish — but you can already cook from it.
                </p>
              </div>
            ) : null}

            {r.moderationStatus !== "approved" && (isOwner || canDeleteRecipe) ? (
              <div className="mb-5 rounded-2xl border border-terracotta/40 bg-terracotta-tint/50 px-5 py-4 print:hidden">
                <p className="text-sm font-semibold text-terracotta-strong">
                  {r.moderationStatus === "rejected"
                    ? "Hidden after review"
                    : "Held for review"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {r.moderationStatus === "rejected"
                    ? "A moderator kept this recipe out of public listings. You can still view and edit it — editing re-runs the check."
                    : "Our safety check flagged something, so this recipe is hidden from Discover and search until a moderator takes a look. You can still view, edit, and cook it."}
                </p>
              </div>
            ) : null}

            <h1 data-translate className="text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
              {r.title}
            </h1>

            <div className="mt-4">
              <CreatorProfileBar
                channelId={ch.id}
                channelSlug={ch.slug}
                channelTitle={ch.title}
                avatarUrl={avatarPublicUrl}
                followerCount={followerCount}
                following={following}
                isOwner={isOwner}
                isLoggedIn={Boolean(user)}
                signInHref={`/sign-in?next=/recipe/${id}`}
                compact
              />
            </div>

            {r.description && (
              <p data-translate className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
                {r.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-sunken px-3 py-1 text-xs font-medium text-ink-soft">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="7.25" />
                  <path d="M2.9 10h14.2M10 2.9c1.9 2 2.9 4.5 2.9 7.1s-1 5.1-2.9 7.1c-1.9-2-2.9-4.5-2.9-7.1s1-5.1 2.9-7.1z" />
                </svg>
                Written in {languageLabel(r.language)}
              </span>
              <TranslateRecipeButton
                sourceLanguage={r.language}
                sourceLabel={languageLabel(r.language)}
              />
            </div>

            {tags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/discover?tag=${encodeURIComponent(t.slug)}`}
                    className="rounded-full border border-sand-strong bg-surface px-3 py-1 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong print:border-neutral-400 print:bg-white"
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {coverPublicUrl ? (
              <figure className="mt-7 print:hidden">
                <div className="relative aspect-[16/10] max-h-[26rem] w-full overflow-hidden rounded-[1.5rem] ring-1 ring-black/5">
                  <Image src={coverPublicUrl} alt="" fill className="object-cover" priority unoptimized />
                </div>
                {coverAttribution ? (
                  <figcaption className="mt-2 text-xs text-ink-muted">
                    {coverAttribution.url ? (
                      <a
                        href={coverAttribution.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-terracotta-strong"
                      >
                        {coverAttribution.text}
                      </a>
                    ) : (
                      coverAttribution.text
                    )}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
          </header>

          {/* Quick stats */}
          {totalDurationSeconds > 0 && (
            <div className="grid grid-cols-3 divide-x divide-sand overflow-hidden rounded-2xl border border-sand bg-surface print:hidden">
              <RecipeStat
                label={totalTime.estimated ? "Time (estimated)" : "Active time"}
                value={totalDurationLabel}
              />
              <RecipeStat label="Steps" value={String(steps.length)} />
              <RecipeStat label="Ingredients" value={String(r.ingredients?.length ?? 0)} />
            </div>
          )}

          {/* Ingredients */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
              {ingredientSystemTitle(r.ingredientMeasureSystem ?? "metric")}
            </p>
            <h2 className="mt-1.5">Ingredients</h2>
            <p className="mt-2 text-xs text-ink-muted print:hidden">
              Tick them off as you gather — boxes print empty so you can check them by hand.
            </p>

            <div className="recipe-block mt-5 overflow-hidden rounded-2xl border border-sand bg-surface">
              {(r.ingredients ?? []).length === 0 ? (
                <div className="p-6 text-center text-ink-muted">
                  <p>No ingredients listed for this recipe.</p>
                </div>
              ) : (
                <ul className="divide-y divide-sand">
                  {(r.ingredients ?? []).map((ing, i) => (
                    <li key={i} className="transition hover:bg-sunken/40 print:hover:bg-transparent">
                      <label className="flex cursor-pointer items-start gap-3.5 px-5 py-3.5 print:cursor-default">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta print:rounded-sm"
                          aria-label={`Ingredient: ${ing.name}`}
                        />
                        <span className="text-ink">
                          {ing.amount ? <span className="font-semibold tabular-nums">{ing.amount}</span> : null}
                          {ing.unit ? <span className="text-ink-muted"> {ing.unit}</span> : null}
                          {(ing.amount || ing.unit) && ing.name ? (
                            <span data-translate className="ml-1.5">{ing.name}</span>
                          ) : null}
                          {!ing.amount && !ing.unit ? <span data-translate>{ing.name}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Steps */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Method</p>
            <h2 className="mt-1.5">Steps</h2>
            <p className="mt-2 text-xs text-ink-muted print:hidden">
              Check off steps as you go — timers run automatically in cook mode.
            </p>

            <div className="mt-5 space-y-4">
              {steps.length === 0 ? (
                <div className="rounded-2xl border border-sand bg-surface p-6 text-center text-ink-muted">
                  <p>No steps defined for this recipe.</p>
                </div>
              ) : (
                steps.map((s, idx) => {
                  const stepDurationLabel =
                    s.durationSeconds && s.durationSeconds > 0
                      ? humanDurationSeconds(s.durationSeconds)
                      : null;
                  return (
                    <div key={s.id} className="recipe-block rounded-2xl border border-sand bg-surface p-5 sm:p-6">
                      <label className="flex cursor-pointer gap-4 print:cursor-default">
                        <input
                          type="checkbox"
                          className="mt-1.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-terracotta print:rounded-sm"
                          aria-label={`Step ${idx + 1}${s.title.trim() ? `: ${s.title}` : ""}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-2.5 flex flex-wrap items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-tint font-display text-base font-semibold text-terracotta-strong print:bg-neutral-200 print:text-neutral-900">
                              {idx + 1}
                            </span>
                            {s.title.trim() ? <h3 data-translate className="text-lg">{s.title}</h3> : null}
                            {stepDurationLabel ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-tint px-3 py-1 text-xs font-semibold text-terracotta-strong print:bg-neutral-100 print:text-neutral-800">
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  className="h-3.5 w-3.5 print:hidden"
                                  aria-hidden="true"
                                >
                                  <circle cx="10" cy="10" r="7.25" />
                                  <path d="M10 5.5V10l3 2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {stepDurationLabel}
                              </span>
                            ) : null}
                          </div>
                          {s.imagePublicUrl ? (
                            <div className="relative mb-4 aspect-video max-h-56 w-full max-w-lg overflow-hidden rounded-xl ring-1 ring-black/5 print:hidden">
                              <Image src={s.imagePublicUrl} alt="" fill className="object-cover" unoptimized />
                            </div>
                          ) : null}
                          <p data-translate className="leading-relaxed text-ink-soft">{s.instruction}</p>
                        </div>
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <p className="hidden border-t border-neutral-300 pt-6 text-center text-xs text-neutral-600 print:block">
            {r.title} · {ch.title}
            {recipePageUrl ? (
              <>
                <br />
                <span className="break-all">{recipePageUrl}</span>
              </>
            ) : (
              <>
                <br />
                Focolare
              </>
            )}
          </p>
        </div>

        {/* ---- Cook-mode rail: sticky on desktop, in-flow at the bottom on mobile ---- */}
        <aside className="mt-10 lg:mt-0 print:hidden">
          <div className="lg:sticky lg:top-24">
            {session?.user ? (
              <StartCookForm
                recipeId={r.id}
                stepInputs={cookStepInputs}
                timingEstimated={totalTime.estimated}
              />
            ) : (
              <div className="rounded-3xl border border-sand bg-surface p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
                  Cook mode
                </p>
                <h2 className="mt-2 text-xl">Cook this on your schedule</h2>
                <p className="mb-5 mt-2 text-sm leading-relaxed text-ink-soft">
                  Sign in to start guided cook mode — timers, reminders, and a plan that works
                  backwards from when you want it ready.
                </p>
                <Link href={`/sign-in?next=/recipe/${id}`} className="btn btn-primary w-full">
                  Sign in to cook
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}

function RecipeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 text-center sm:px-5">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ink-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold text-terracotta-strong sm:text-2xl">
        {value}
      </div>
    </div>
  );
}
