"use server";

import { and, asc, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { recipe, recipeStep } from "@/db/schema";
import { getOrCreateChannelForUser } from "@/lib/ensure-channel";
import { slugify } from "@/lib/slug";
import { getServerSession } from "@/lib/session";
import { nanoid } from "nanoid";

export async function listPublishedRecipes(opts?: { q?: string }) {
  const q = opts?.q?.trim();
  const published = isNotNull(recipe.publishedAt);
  const visibility = eq(recipe.visibility, "public");
  const whereClause =
    q && q.length > 0
      ? and(
          published,
          visibility,
          or(ilike(recipe.title, `%${q}%`), ilike(recipe.description, `%${q}%`)),
        )
      : and(published, visibility);
  return db
    .select()
    .from(recipe)
    .where(whereClause)
    .orderBy(desc(recipe.createdAt))
    .limit(40);
}

export async function createRecipeAction(form: {
  title: string;
  description: string;
  visibility: "public" | "members";
  taxonomyCategoryId?: string | null;
  ingredients: { name: string; amount?: string; unit?: string }[];
  steps: {
    title: string;
    instruction: string;
    durationSeconds: number | null;
    offsetFromPrevious: number;
  }[];
}): Promise<{ recipeId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!form.title.trim()) return { error: "Title required" };
  if (!form.steps.length) return { error: "At least one step" };

  const ch = await getOrCreateChannelForUser({
    userId: session.user.id,
    displayName: session.user.name ?? "Creator",
  });

  let slug = slugify(form.title);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [r] = await db
        .insert(recipe)
        .values({
          channelId: ch.id,
          taxonomyCategoryId: form.taxonomyCategoryId ?? null,
          title: form.title.trim(),
          slug,
          description: form.description.trim() || null,
          ingredients: form.ingredients,
          visibility: form.visibility,
          publishedAt: new Date(),
        })
        .returning();
      if (!r) return { error: "Insert failed" };

      await db.insert(recipeStep).values(
        form.steps.map((s, i) => ({
          recipeId: r.id,
          position: i,
          title: s.title,
          instruction: s.instruction,
          durationSeconds: s.durationSeconds,
          offsetFromPrevious: i === 0 ? 0 : s.offsetFromPrevious,
        })),
      );
      return { recipeId: r.id };
    } catch {
      slug = `${slugify(form.title)}-${nanoid(4).toLowerCase()}`;
    }
  }
  return { error: "Could not allocate unique slug" };
}

export async function getRecipeBundle(recipeId: string) {
  const [r] = await db.select().from(recipe).where(eq(recipe.id, recipeId)).limit(1);
  if (!r) return null;
  const steps = await db
    .select()
    .from(recipeStep)
    .where(eq(recipeStep.recipeId, recipeId))
    .orderBy(asc(recipeStep.position));
  return { recipe: r, steps };
}
