import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveCategories } from "@/actions/taxonomy";
import { formField } from "@/lib/form-styles";
import { getServerSession } from "@/lib/session";
import { submitCategorySuggestion } from "./actions";

export default async function SuggestTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  const categories = await listActiveCategories();
  const params = await searchParams;
  const error = params.error;
  const from = params.from;
  const backHref = from?.startsWith("/") ? from : "/discover";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Suggest a category</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You are proposing a <strong>new</strong> category label. It stays <strong>pending</strong> until someone
          listed in <code className="rounded bg-amber-100 px-1 text-amber-950">ADMIN_EMAILS</code> approves it in the
          database—nothing appears in the public list until then.
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          <strong>Optional parent:</strong> if you pick a parent (for example <em>Baking</em>), you are asking for a{" "}
          <strong>subcategory</strong> under that parent. After approval, it shows in the category tree like{" "}
          <em>Baking → Your label</em> and recipes can be filed under it like any other category.
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Leave parent as “Top level” if your idea should sit alongside Baking, Cooking, etc.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <form action={submitCategorySuggestion} className="card space-y-4 p-6 shadow-sm">
        {from?.startsWith("/") ? <input type="hidden" name="returnTo" value={from} /> : null}
        <div>
          <label htmlFor="label" className="text-sm font-medium text-neutral-800">
            New category name
          </label>
          <input
            id="label"
            name="label"
            required
            placeholder="e.g. Fermentation"
            className={`mt-1 ${formField}`}
          />
        </div>
        <div>
          <label htmlFor="parent" className="text-sm font-medium text-neutral-800">
            Parent (optional — makes this a subcategory)
          </label>
          <select id="parent" name="parent" className={`mt-1 ${formField}`}>
            <option value="">— Top level —</option>
            {categories.map((c) => {
              const parent = c.parentId ? categories.find((x) => x.id === c.parentId) : null;
              const label = parent ? `${parent.label} → ${c.label}` : c.label;
              return (
                <option key={c.id} value={c.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label htmlFor="synonyms" className="text-sm font-medium text-neutral-800">
            Synonyms (optional)
          </label>
          <input
            id="synonyms"
            name="synonyms"
            placeholder="e.g. levain, sourdough starter"
            className={`mt-1 ${formField}`}
          />
        </div>
        <button type="submit" className="btn btn-primary w-full font-semibold">
          Submit suggestion
        </button>
      </form>

      <Link href={backHref} className="text-sm font-medium text-amber-800 hover:text-amber-900 hover:underline">
        ← Back
      </Link>
    </div>
  );
}
