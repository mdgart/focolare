"use server";

import { redirect } from "next/navigation";
import { suggestTaxonomyAction } from "@/actions/taxonomy";

function withQueryParam(path: string, key: string, value: string): string {
  if (!path.startsWith("/")) return `/discover?${key}=${encodeURIComponent(value)}`;
  const [base, existing] = path.split("?");
  const sp = new URLSearchParams(existing ?? "");
  sp.set(key, value);
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}

export async function submitCategorySuggestion(formData: FormData) {
  const proposedLabel = String(formData.get("label") ?? "");
  const parentCategoryId = String(formData.get("parent") || "") || null;
  const synonyms = String(formData.get("synonyms") || "") || null;
  const returnTo = String(formData.get("returnTo") || "").trim();
  const res = await suggestTaxonomyAction({
    proposedLabel,
    parentCategoryId,
    synonyms,
  });
  if ("error" in res) {
    const q = new URLSearchParams({ error: res.error });
    if (returnTo.startsWith("/")) q.set("from", returnTo);
    redirect(`/taxonomy/suggest?${q.toString()}`);
  }
  const target = returnTo.startsWith("/") ? returnTo : "/discover";
  redirect(withQueryParam(target, "categorySuggested", "1"));
}
