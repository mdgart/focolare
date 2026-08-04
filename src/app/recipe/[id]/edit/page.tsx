import { notFound, permanentRedirect } from "next/navigation";
import { getRecipePath } from "@/actions/recipes";

/** The old editor address — see the note on the recipe page beside this one. */
export default async function LegacyEditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = await getRecipePath(id);
  if (!path) notFound();
  permanentRedirect(`${path}/edit`);
}
