import { redirect } from "next/navigation";
import { listActiveCategories, listCategoriesForRecipeEditor } from "@/actions/taxonomy";
import { isAiRecipeEnabled } from "@/lib/openai";
import { stockPhotosEnabled } from "@/lib/stock-photos";
import { getServerSession } from "@/lib/session";
import { CreateRecipeForm } from "./create-recipe-form";

export default async function CreateRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ categorySuggested?: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  const { categorySuggested } = await searchParams;
  const [editorCategories, activeForParent] = await Promise.all([
    listCategoriesForRecipeEditor(session.user.id),
    listActiveCategories(),
  ]);
  const parentCategoryOptions = activeForParent.map((c) => {
    const parent = c.parentId ? activeForParent.find((x) => x.id === c.parentId) : null;
    const label = parent ? `${parent.label} → ${c.label}` : c.label;
    return { id: c.id, label };
  });
  return (
    <div className="mx-auto max-w-3xl">
      <div className="pb-8 pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Share your craft
        </p>
        <h1 className="text-3xl sm:text-4xl">Create a recipe</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
          Timed steps make your recipe cookable with guided timers — readers pick when they want it
          ready, and Focolare plans backwards.
        </p>
      </div>

      {categorySuggested ? (
        <p className="mb-6 rounded-2xl border border-sage/40 bg-[#eef2ea] px-5 py-4 text-sm text-ink">
          Category suggestion received. If you suggested from the full suggest page, refresh after an
          admin approves it. Suggestions from this form&apos;s modal are available in the dropdown
          immediately.
        </p>
      ) : null}

      <CreateRecipeForm
        categories={editorCategories}
        parentCategoryOptions={parentCategoryOptions}
        aiEnabled={isAiRecipeEnabled()}
        stockPhotosEnabled={stockPhotosEnabled()}
      />
    </div>
  );
}
