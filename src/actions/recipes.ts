"use server";

import { and, asc, desc, eq, exists, getTableColumns, ilike, inArray, isNotNull, notExists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { channel, mediaAsset, recipe, recipeStep, recipeTag, tag, taxonomyCategory, user } from "@/db/schema";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { blockedFromPublishing } from "@/lib/email-verification";
import { getOrCreateChannelForUser } from "@/lib/ensure-channel";
import { normalizeLanguage } from "@/lib/languages";
import { normalizeMealTags } from "@/lib/meal-tags";
import { moderateContent, recipeToModerationText } from "@/lib/moderation";
import { slugify } from "@/lib/slug";
import { getServerSession } from "@/lib/session";
import { nanoid } from "nanoid";

const channelAvatarMedia = alias(mediaAsset, "channel_avatar_media");

/**
 * Servings as a whole number, or null.
 *
 * Null rather than a default, because quantities get scaled off this: a recipe
 * wrongly recorded as serving 4 silently halves everyone's shopping when they
 * ask for 2. "Doesn't say" is a real answer and the UI handles it.
 */
function normalizeServings(value: number | null | undefined): number | null {
  if (value == null) return null;
  const whole = Math.floor(value);
  if (!Number.isFinite(whole) || whole < 1 || whole > 100) return null;
  return whole;
}

/** Category id plus all active descendants (for parent filters). Unknown ids fall back to exact match. */
async function activeCategoryIdsForTaxonomyFilter(taxId: string): Promise<string[]> {
  const rows = await db
    .select({ id: taxonomyCategory.id, parentId: taxonomyCategory.parentId })
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.isActive, true));
  if (!rows.some((r) => r.id === taxId)) return [taxId];
  const descendants: string[] = [];
  const walk = (parent: string) => {
    for (const r of rows) {
      if (r.parentId === parent) {
        descendants.push(r.id);
        walk(r.id);
      }
    }
  };
  walk(taxId);
  if (descendants.length === 0) return [taxId];
  return [taxId, ...descendants];
}

export async function listPublishedRecipes(opts?: {
  q?: string;
  taxonomyCategoryId?: string;
  tagSlug?: string;
}) {
  const q = opts?.q?.trim();
  const taxId = opts?.taxonomyCategoryId?.trim();
  const tagSlug = opts?.tagSlug?.trim();
  const published = isNotNull(recipe.publishedAt);
  const visibility = eq(recipe.visibility, "public");
  /** Anything the safety check flagged stays out of public listings until an admin clears it. */
  const safe = eq(recipe.moderationStatus, "approved");
  /** Blocked accounts disappear from public view without their content being deleted. */
  const ownerActive = notExists(
    db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, channel.ownerUserId), isNotNull(user.blockedAt))),
  );
  const tax = taxId ? inArray(recipe.taxonomyCategoryId, await activeCategoryIdsForTaxonomyFilter(taxId)) : undefined;
  const tagExists =
    tagSlug && tagSlug.length > 0
      ? exists(
          db
            .select({ id: recipeTag.recipeId })
            .from(recipeTag)
            .innerJoin(tag, eq(recipeTag.tagId, tag.id))
            .where(and(eq(recipeTag.recipeId, recipe.id), eq(tag.slug, tagSlug))),
        )
      : undefined;
  const search =
    q && q.length > 0
      ? or(ilike(recipe.title, `%${q}%`), ilike(recipe.description, `%${q}%`))
      : undefined;
  const whereClause = and(published, visibility, safe, ownerActive, search, tax, tagExists);
  return db
    .select({
      ...getTableColumns(recipe),
      coverPublicUrl: mediaAsset.publicUrl,
      channelTitle: channel.title,
      channelSlug: channel.slug,
      channelAvatarUrl: channelAvatarMedia.publicUrl,
    })
    .from(recipe)
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .leftJoin(channelAvatarMedia, eq(channel.avatarMediaId, channelAvatarMedia.id))
    .where(whereClause)
    .orderBy(desc(recipe.createdAt))
    .limit(40);
}

export type UserRecipeRow = {
  id: string;
  title: string;
  visibility: "public" | "private";
  publishedAt: Date | null;
  moderationStatus: "approved" | "flagged" | "rejected";
  updatedAt: Date;
  coverPublicUrl: string | null;
};

export async function listRecipesForUser(userId: string): Promise<UserRecipeRow[]> {
  return db
    .select({
      id: recipe.id,
      title: recipe.title,
      visibility: recipe.visibility,
      publishedAt: recipe.publishedAt,
      moderationStatus: recipe.moderationStatus,
      updatedAt: recipe.updatedAt,
      coverPublicUrl: mediaAsset.publicUrl,
    })
    .from(recipe)
    .innerJoin(channel, eq(recipe.channelId, channel.id))
    .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
    .where(eq(channel.ownerUserId, userId))
    .orderBy(desc(recipe.updatedAt));
}

async function assertRecipeOwner(
  recipeId: string,
  sessionUser: { id: string; email?: string | null },
): Promise<
  | { ok: true; recipeRow: typeof recipe.$inferSelect; channelId: string }
  | { error: string }
> {
  const [row] = await db
    .select({
      recipeRow: recipe,
      ownerUserId: channel.ownerUserId,
      channelId: channel.id,
    })
    .from(recipe)
    .innerJoin(channel, eq(channel.id, recipe.channelId))
    .where(eq(recipe.id, recipeId))
    .limit(1);
  if (!row) return { error: "Not found" };
  const isAdmin = await isAdminSessionUser(sessionUser);
  if (row.ownerUserId !== sessionUser.id && !isAdmin) return { error: "Forbidden" };
  return { ok: true as const, recipeRow: row.recipeRow, channelId: row.channelId };
}

async function verifyMediaOwnedByUser(userId: string, mediaIds: (string | null | undefined)[]): Promise<boolean> {
  const ids = [...new Set(mediaIds.filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return true;
  const rows = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.ownerUserId, userId), inArray(mediaAsset.id, ids)));
  return rows.length === ids.length;
}

/** Looks up storage keys + mime types so images can be sent to the safety check. */
async function mediaForModeration(
  mediaIds: (string | null | undefined)[],
): Promise<{ storageKey: string; mimeType: string; publicUrl: string }[]> {
  const ids = [...new Set(mediaIds.filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return [];
  return db
    .select({
      storageKey: mediaAsset.storageKey,
      mimeType: mediaAsset.mimeType,
      publicUrl: mediaAsset.publicUrl,
    })
    .from(mediaAsset)
    .where(inArray(mediaAsset.id, ids));
}

/**
 * Runs a submission through the safety check.
 * Returns the row fields to persist, or an error when the content is rejected.
 */
async function moderateSubmission(form: {
  title: string;
  description: string;
  ingredients: { name: string; amount?: string; unit?: string }[];
  tags: string[];
  steps: { title: string; instruction: string }[];
  coverMediaId?: string | null;
  stepMediaIds: (string | null | undefined)[];
}): Promise<
  | { error: string }
  | {
      moderationStatus: "approved" | "flagged";
      moderationFlags: { category: string; score: number }[];
      moderatedAt: Date;
    }
> {
  const verdict = await moderateContent({
    text: recipeToModerationText({
      title: form.title,
      description: form.description,
      ingredients: form.ingredients,
      steps: form.steps,
      tags: form.tags,
    }),
    images: await mediaForModeration([form.coverMediaId, ...form.stepMediaIds]),
  });

  if (verdict.action === "reject") return { error: verdict.message };
  return {
    moderationStatus: verdict.action === "flag" ? "flagged" : "approved",
    moderationFlags: verdict.action === "flag" ? verdict.categories : [],
    moderatedAt: new Date(),
  };
}

async function replaceRecipeTags(recipeId: string, labels: string[]): Promise<void> {
  const normalized = [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 24);
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId));
  for (const label of normalized) {
    const slug = slugify(label);
    const safeLabel = label.slice(0, 120);
    await db.insert(tag).values({ slug, label: safeLabel }).onConflictDoNothing({ target: tag.slug });
    const [row] = await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug)).limit(1);
    if (row) {
      await db.insert(recipeTag).values({ recipeId, tagId: row.id });
    }
  }
}

export async function createRecipeAction(form: {
  title: string;
  description: string;
  visibility: "public" | "private";
  taxonomyCategoryId: string;
  coverMediaId?: string | null;
  language?: string;
  /** false keeps the recipe as a draft (publishedAt stays null). Defaults to publishing. */
  publish?: boolean;
  ingredientMeasureSystem: "metric" | "us";
  /** How many it makes. Null or omitted when the recipe doesn't say. */
  servings?: number | null;
  /** Occasions it's for. Empty means untagged, which suits any meal. */
  mealTimes?: string[];
  ingredients: { name: string; amount?: string; unit?: string }[];
  tags: string[];
  steps: {
    title: string;
    instruction: string;
    durationSeconds: number | null;
    offsetFromPrevious: number;
    imageMediaId?: string | null;
  }[];
}): Promise<{ recipeId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!form.title.trim()) return { error: "Title required" };
  if (!form.steps.length) return { error: "At least one step" };
  if (!form.taxonomyCategoryId?.trim()) {
    return { error: "Choose a category, or use “Suggest a category” if yours is missing." };
  }

  const taxonomyTrim = form.taxonomyCategoryId.trim();
  const [catRow] = await db
    .select({
      id: taxonomyCategory.id,
      isActive: taxonomyCategory.isActive,
      proposerUserId: taxonomyCategory.proposerUserId,
    })
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.id, taxonomyTrim))
    .limit(1);
  if (!catRow) return { error: "Invalid category" };
  if (!catRow.isActive && catRow.proposerUserId !== session.user.id) {
    return { error: "You cannot use that category" };
  }

  const ingredientMeasureSystem = form.ingredientMeasureSystem === "us" ? "us" : "metric";

  const mediaToCheck = [form.coverMediaId, ...form.steps.map((s) => s.imageMediaId)];
  if (!(await verifyMediaOwnedByUser(session.user.id, mediaToCheck))) {
    return { error: "One or more images are invalid or not owned by your account" };
  }

  // Drafts are always allowed; only making something visible needs a confirmed address.
  if (form.publish !== false) {
    const blocked = await blockedFromPublishing(session.user.id);
    if (blocked) return { error: blocked };
  }

  const moderation = await moderateSubmission({
    title: form.title,
    description: form.description,
    ingredients: form.ingredients,
    tags: form.tags,
    steps: form.steps,
    coverMediaId: form.coverMediaId,
    stepMediaIds: form.steps.map((s) => s.imageMediaId),
  });
  if ("error" in moderation) return moderation;

  const ch = await getOrCreateChannelForUser({
    userId: session.user.id,
    displayName: session.user.name ?? "Creator",
  });

  let slug = slugify(form.title);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [r] = await db
        .insert(recipe)
        .values({
          channelId: ch.id,
          taxonomyCategoryId: taxonomyTrim,
          title: form.title.trim(),
          slug,
          description: form.description.trim() || null,
          ingredients: form.ingredients,
          ingredientMeasureSystem,
          servings: normalizeServings(form.servings),
          mealTimes: normalizeMealTags(form.mealTimes),
          visibility: form.visibility,
          publishedAt: form.publish === false ? null : new Date(),
          coverMediaId: form.coverMediaId ?? null,
          language: normalizeLanguage(form.language),
          ...moderation,
        })
        .returning();
      if (!r) return { error: "Insert failed" };

      await db.insert(recipeStep).values(
        form.steps.map((s, i) => ({
          recipeId: r.id,
          position: i,
          title: s.title,
          instruction: s.instruction,
          durationSeconds: s.durationSeconds,
          offsetFromPrevious: i === 0 ? 0 : s.offsetFromPrevious,
          imageMediaId: s.imageMediaId ?? null,
        })),
      );
      await replaceRecipeTags(r.id, form.tags);
      return { recipeId: r.id };
    } catch {
      slug = `${slugify(form.title)}-${nanoid(4).toLowerCase()}`;
    }
  }
  return { error: "Could not allocate unique slug" };
}

export async function updateRecipeAction(
  recipeId: string,
  form: {
    title: string;
    description: string;
    visibility: "public" | "private";
    taxonomyCategoryId: string;
    coverMediaId?: string | null;
    language?: string;
    /** true publishes a draft; false returns it to draft. Omit to leave the state alone. */
    publish?: boolean;
    ingredientMeasureSystem: "metric" | "us";
    servings?: number | null;
    mealTimes?: string[];
    ingredients: { name: string; amount?: string; unit?: string }[];
    tags: string[];
    steps: {
      title: string;
      instruction: string;
      durationSeconds: number | null;
      offsetFromPrevious: number;
      imageMediaId?: string | null;
    }[];
  },
): Promise<{ recipeId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!form.title.trim()) return { error: "Title required" };
  if (!form.steps.length) return { error: "At least one step" };
  if (!form.taxonomyCategoryId?.trim()) {
    return { error: "Choose a category, or use “Suggest a category” if yours is missing." };
  }

  const owned = await assertRecipeOwner(recipeId, session.user);
  if ("error" in owned) return owned;

  const taxonomyTrim = form.taxonomyCategoryId.trim();
  const [catRow] = await db
    .select({
      id: taxonomyCategory.id,
      isActive: taxonomyCategory.isActive,
      proposerUserId: taxonomyCategory.proposerUserId,
    })
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.id, taxonomyTrim))
    .limit(1);
  if (!catRow) return { error: "Invalid category" };
  if (!catRow.isActive && catRow.proposerUserId !== session.user.id) {
    return { error: "You cannot use that category" };
  }

  const ingredientMeasureSystem = form.ingredientMeasureSystem === "us" ? "us" : "metric";
  const mediaToCheck = [form.coverMediaId, ...form.steps.map((s) => s.imageMediaId)];
  if (!(await verifyMediaOwnedByUser(session.user.id, mediaToCheck))) {
    return { error: "One or more images are invalid or not owned by your account" };
  }

  // Only guard the moment something becomes visible, so editing an already
  // published recipe keeps working even if enforcement is turned on later.
  const becomingPublished = form.publish === true && owned.recipeRow.publishedAt === null;
  if (becomingPublished) {
    const blocked = await blockedFromPublishing(session.user.id);
    if (blocked) return { error: blocked };
  }

  const moderation = await moderateSubmission({
    title: form.title,
    description: form.description,
    ingredients: form.ingredients,
    tags: form.tags,
    steps: form.steps,
    coverMediaId: form.coverMediaId,
    stepMediaIds: form.steps.map((s) => s.imageMediaId),
  });
  if ("error" in moderation) return moderation;

  const titleTrim = form.title.trim();
  let slug = owned.recipeRow.slug;
  if (slugify(titleTrim) !== slugify(owned.recipeRow.title)) {
    slug = slugify(titleTrim);
    for (let attempt = 0; attempt < 6; attempt++) {
      const clash = await db
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(eq(recipe.channelId, owned.channelId), eq(recipe.slug, slug)))
        .limit(1);
      if (!clash[0] || clash[0].id === recipeId) break;
      slug = `${slugify(titleTrim)}-${nanoid(4).toLowerCase()}`;
    }
  }

  await db
    .update(recipe)
    .set({
      taxonomyCategoryId: taxonomyTrim,
      title: titleTrim,
      slug,
      description: form.description.trim() || null,
      ingredients: form.ingredients,
      ingredientMeasureSystem,
      servings: normalizeServings(form.servings),
      mealTimes: normalizeMealTags(form.mealTimes),
      visibility: form.visibility,
      coverMediaId: form.coverMediaId ?? null,
      language: normalizeLanguage(form.language),
      updatedAt: new Date(),
      ...(form.publish === undefined
        ? {}
        : { publishedAt: form.publish ? (owned.recipeRow.publishedAt ?? new Date()) : null }),
      ...moderation,
    })
    .where(eq(recipe.id, recipeId));

  await db.delete(recipeStep).where(eq(recipeStep.recipeId, recipeId));
  await db.insert(recipeStep).values(
    form.steps.map((s, i) => ({
      recipeId,
      position: i,
      title: s.title,
      instruction: s.instruction,
      durationSeconds: s.durationSeconds,
      offsetFromPrevious: i === 0 ? 0 : s.offsetFromPrevious,
      imageMediaId: s.imageMediaId ?? null,
    })),
  );
  await replaceRecipeTags(recipeId, form.tags);

  return { recipeId };
}

export type RecipeStepWithImage = typeof recipeStep.$inferSelect & { imagePublicUrl: string | null };

export type RecipeTagRow = { slug: string; label: string };

export async function getRecipeBundle(recipeId: string) {
  const [r] = await db.select().from(recipe).where(eq(recipe.id, recipeId)).limit(1);
  if (!r) return null;

  let coverPublicUrl: string | null = null;
  let coverAttribution: { text: string; url: string | null } | null = null;
  if (r.coverMediaId) {
    const [cover] = await db
      .select({
        publicUrl: mediaAsset.publicUrl,
        attribution: mediaAsset.attribution,
        attributionUrl: mediaAsset.attributionUrl,
      })
      .from(mediaAsset)
      .where(eq(mediaAsset.id, r.coverMediaId))
      .limit(1);
    coverPublicUrl = cover?.publicUrl ?? null;
    // Only stock imports carry credit; uploads and AI images have none.
    coverAttribution = cover?.attribution
      ? { text: cover.attribution, url: cover.attributionUrl }
      : null;
  }

  const stepRows = await db
    .select({
      step: recipeStep,
      imagePublicUrl: mediaAsset.publicUrl,
    })
    .from(recipeStep)
    .leftJoin(mediaAsset, eq(recipeStep.imageMediaId, mediaAsset.id))
    .where(eq(recipeStep.recipeId, recipeId))
    .orderBy(asc(recipeStep.position));

  const steps: RecipeStepWithImage[] = stepRows.map(({ step, imagePublicUrl }) => ({
    ...step,
    imagePublicUrl,
  }));

  const tags: RecipeTagRow[] = await db
    .select({ slug: tag.slug, label: tag.label })
    .from(recipeTag)
    .innerJoin(tag, eq(tag.id, recipeTag.tagId))
    .where(eq(recipeTag.recipeId, recipeId))
    .orderBy(tag.label);

  return { recipe: r, coverPublicUrl, coverAttribution, steps, tags };
}

/** Publish a draft, or return a published recipe to draft. Owner (or admin) only. */
export async function setRecipePublishedAction(
  recipeId: string,
  published: boolean,
): Promise<{ ok: true; published: boolean } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const owned = await assertRecipeOwner(recipeId, session.user);
  if ("error" in owned) return owned;

  if (published && owned.recipeRow.moderationStatus === "rejected") {
    return { error: "This recipe was held back by review and can't be published." };
  }

  await db
    .update(recipe)
    .set({
      // Keep the original publish date when re-publishing, so ordering stays stable.
      publishedAt: published ? (owned.recipeRow.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(recipe.id, recipeId));

  revalidatePath("/");
  revalidatePath("/discover");
  revalidatePath(`/recipe/${recipeId}`);
  return { ok: true as const, published };
}

export async function deleteRecipeAction(recipeId: string): Promise<
  { ok: true; channelSlug: string } | { error: string }
> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const owned = await assertRecipeOwner(recipeId, session.user);
  if ("error" in owned) return owned;

  const [row] = await db
    .select({ channelSlug: channel.slug })
    .from(channel)
    .where(eq(channel.id, owned.channelId))
    .limit(1);
  if (!row) return { error: "Not found" };

  await db.delete(recipe).where(eq(recipe.id, recipeId));
  return { ok: true as const, channelSlug: row.channelSlug };
}
