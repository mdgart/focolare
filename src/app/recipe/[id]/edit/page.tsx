import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  listActiveCategories,
  listCategoriesForRecipeEditor,
} from "@/actions/taxonomy";
import { getRecipeBundle } from "@/actions/recipes";
import { CreateRecipeForm, type RecipeFormInitial } from "@/app/create/recipe/create-recipe-form";
import { db } from "@/db";
import { channel, taxonomyCategory } from "@/db/schema";
import { secondsToDurationParts } from "@/lib/format-duration";
import { formatIngredientLine } from "@/lib/ingredient-measure";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { isAiRecipeEnabled } from "@/lib/openai";
import { stockPhotosEnabled } from "@/lib/stock-photos";
import { getServerSession } from "@/lib/session";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) redirect(`/sign-in?next=/recipe/${id}/edit`);

  const bundle = await getRecipeBundle(id);
  if (!bundle) notFound();

  const [ch] = await db.select().from(channel).where(eq(channel.id, bundle.recipe.channelId)).limit(1);
  if (!ch) notFound();

  const isAdmin = await isAdminSessionUser(session.user);
  if (ch.ownerUserId !== session.user.id && !isAdmin) notFound();

  const [editorCategories, activeForParent] = await Promise.all([
    listCategoriesForRecipeEditor(session.user.id),
    listActiveCategories(),
  ]);

  let categoryLabel = "Current category";
  if (bundle.recipe.taxonomyCategoryId) {
    const [cat] = await db
      .select({ label: taxonomyCategory.label })
      .from(taxonomyCategory)
      .where(eq(taxonomyCategory.id, bundle.recipe.taxonomyCategoryId))
      .limit(1);
    if (cat) categoryLabel = cat.label;
  }

  const categories = editorCategories.some((c) => c.id === bundle.recipe.taxonomyCategoryId)
    ? editorCategories
    : bundle.recipe.taxonomyCategoryId
      ? [...editorCategories, { id: bundle.recipe.taxonomyCategoryId, label: categoryLabel }]
      : editorCategories;

  const parentCategoryOptions = activeForParent.map((c) => {
    const parent = c.parentId ? activeForParent.find((x) => x.id === c.parentId) : null;
    const label = parent ? `${parent.label} → ${c.label}` : c.label;
    return { id: c.id, label };
  });

  const initial: RecipeFormInitial = {
    recipeId: id,
    title: bundle.recipe.title,
    description: bundle.recipe.description ?? "",
    visibility: bundle.recipe.visibility,
    taxonomyId: bundle.recipe.taxonomyCategoryId ?? categories[0]?.id ?? "",
    coverImage: bundle.recipe.coverMediaId
      ? {
          mediaId: bundle.recipe.coverMediaId,
          publicUrl: bundle.coverPublicUrl ?? "",
        }
      : null,
    ingredientMeasureSystem: bundle.recipe.ingredientMeasureSystem,
    ingredients: bundle.recipe.ingredients.map(formatIngredientLine).join("\n"),
    tagsInput: bundle.tags.map((t) => t.label).join(", "),
    language: bundle.recipe.language,
    isDraft: bundle.recipe.publishedAt === null,
    steps: bundle.steps.map((s, i) => {
      const dur = secondsToDurationParts(s.durationSeconds);
      const off = i === 0 ? { days: "", hours: "", minutes: "0" } : secondsToDurationParts(s.offsetFromPrevious);
      return {
        title: s.title,
        instruction: s.instruction,
        durDays: dur.days,
        durHours: dur.hours,
        durMinutes: dur.minutes,
        offDays: off.days,
        offHours: off.hours,
        offMinutes: off.minutes || "0",
        image:
          s.imageMediaId && s.imagePublicUrl
            ? { mediaId: s.imageMediaId, publicUrl: s.imagePublicUrl }
            : null,
      };
    }),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="pb-8 pt-2 sm:pt-6">
        <Link
          href={`/recipe/${id}`}
          className="text-sm font-medium text-terracotta transition hover:text-terracotta-strong"
        >
          ← Back to recipe
        </Link>
        <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Fine-tune
        </p>
        <h1 className="text-3xl sm:text-4xl">Edit recipe</h1>
      </div>
      <CreateRecipeForm
        categories={categories}
        parentCategoryOptions={parentCategoryOptions}
        initial={initial}
        aiEnabled={isAiRecipeEnabled()}
        stockPhotosEnabled={stockPhotosEnabled()}
      />
    </div>
  );
}
