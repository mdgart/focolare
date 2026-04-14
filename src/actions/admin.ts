"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taxonomyCategory, taxonomySuggestion } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { getServerSession } from "@/lib/session";

function isAdmin(email: string | undefined | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function approveTaxonomySuggestionAction(suggestionId: string) {
  const session = await getServerSession();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { error: "Forbidden" };
  }
  const [sug] = await db
    .select()
    .from(taxonomySuggestion)
    .where(eq(taxonomySuggestion.id, suggestionId))
    .limit(1);
  if (!sug) return { error: "Not found" };
  const slug = slugify(sug.proposedLabel);
  const [cat] = await db
    .insert(taxonomyCategory)
    .values({
      slug: `${slug}-${suggestionId.slice(0, 8)}`,
      label: sug.proposedLabel,
      parentId: sug.parentCategoryId,
      isActive: true,
    })
    .returning();
  await db
    .update(taxonomySuggestion)
    .set({ status: "approved", moderatorNote: `Created category ${cat?.id}` })
    .where(eq(taxonomySuggestion.id, suggestionId));
  return { ok: true as const, categoryId: cat?.id };
}
