import { redirect } from "next/navigation";
import { listActiveCategories } from "@/actions/taxonomy";
import { getServerSession } from "@/lib/session";
import { CreateRecipeForm } from "./create-recipe-form";

export default async function CreateRecipePage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  const categories = await listActiveCategories();
  const flat = categories.map((c) => ({ id: c.id, label: c.label }));
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New recipe</h1>
      <CreateRecipeForm categories={flat} />
    </div>
  );
}
