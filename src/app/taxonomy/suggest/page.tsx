import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveCategories, suggestTaxonomyAction } from "@/actions/taxonomy";
import { getServerSession } from "@/lib/session";

export default async function SuggestTaxonomyPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  const categories = await listActiveCategories();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Suggest a category</h1>
      <p className="text-sm text-neutral-400">
        Proposals stay <strong>pending</strong> until an admin approves them (see{" "}
        <code className="text-amber-200">ADMIN_EMAILS</code> in env).
      </p>
      <form
        className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
        action={async (formData) => {
          "use server";
          const proposedLabel = String(formData.get("label") ?? "");
          const parentCategoryId = String(formData.get("parent") || "") || null;
          const synonyms = String(formData.get("synonyms") || "") || null;
          await suggestTaxonomyAction({
            proposedLabel,
            parentCategoryId,
            synonyms,
          });
        }}
      >
        <div>
          <label className="text-sm text-neutral-400">New label</label>
          <input
            name="label"
            required
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400">Parent (optional)</label>
          <select
            name="parent"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="">— Top level —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400">Synonyms (optional)</label>
          <input
            name="synonyms"
            placeholder="e.g. levain, sourdough starter"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
        >
          Submit suggestion
        </button>
      </form>
      <Link href="/" className="text-sm text-amber-300 hover:underline">
        ← Home
      </Link>
    </div>
  );
}
