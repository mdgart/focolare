import { notFound, permanentRedirect } from "next/navigation";
import { getRecipePath } from "@/actions/recipes";

/**
 * The old address, /recipe/<uuid>. Recipes live at /c/<username>/recipe/<slug>
 * now; this keeps every link, bookmark, and printed sheet from before the change
 * working. Nothing is decided here about who may see the recipe — the canonical
 * page does that.
 */
export default async function LegacyRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = await getRecipePath(id);
  if (!path) notFound();
  permanentRedirect(path);
}
