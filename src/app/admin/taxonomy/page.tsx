import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taxonomyCategory, taxonomySuggestion } from "@/db/schema";
import { ApproveTaxonomySuggestionButton } from "./approve-button";

export const metadata = {
  title: "Admin — Taxonomy · Focolare",
};

export default async function AdminTaxonomyPage() {
  const rows = await db
    .select({
      id: taxonomySuggestion.id,
      proposedLabel: taxonomySuggestion.proposedLabel,
      parentCategoryId: taxonomySuggestion.parentCategoryId,
      placeholderCategoryId: taxonomySuggestion.placeholderCategoryId,
      synonyms: taxonomySuggestion.synonyms,
      createdAt: taxonomySuggestion.createdAt,
      parentLabel: taxonomyCategory.label,
    })
    .from(taxonomySuggestion)
    .leftJoin(taxonomyCategory, eq(taxonomyCategory.id, taxonomySuggestion.parentCategoryId))
    .where(eq(taxonomySuggestion.status, "pending"))
    .orderBy(desc(taxonomySuggestion.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Pending category suggestions</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Approving activates the category for Discover and the recipe editor (slug is assigned on approval).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-600">
          No pending suggestions.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-neutral-900">{row.proposedLabel}</p>
                <p className="text-sm text-neutral-600">
                  {row.parentLabel ? (
                    <>
                      Parent: <span className="font-medium text-neutral-800">{row.parentLabel}</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">Top-level category</span>
                  )}
                  {row.placeholderCategoryId ? (
                    <span className="ml-2 text-xs text-amber-800">(placeholder row)</span>
                  ) : null}
                </p>
                {row.synonyms ? (
                  <p className="text-xs text-neutral-500">
                    Synonyms: <span className="text-neutral-700">{row.synonyms}</span>
                  </p>
                ) : null}
                <p className="text-xs text-neutral-400">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <ApproveTaxonomySuggestionButton suggestionId={row.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
