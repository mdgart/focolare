"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pantryStaple } from "@/db/schema";
import { normalizeIngredientName } from "@/lib/normalize-ingredient";
import { getServerSession } from "@/lib/session";

/**
 * The pantry: ingredients a user always has, subtracted from every grocery list
 * they generate. Stored per user and reused across all their plans.
 */

export type StapleRow = { id: string; name: string };

export async function listPantryStaples(): Promise<StapleRow[]> {
  const session = await getServerSession();
  if (!session?.user?.id) return [];
  return db
    .select({ id: pantryStaple.id, name: pantryStaple.name })
    .from(pantryStaple)
    .where(eq(pantryStaple.userId, session.user.id))
    .orderBy(asc(pantryStaple.name));
}

/** Adds many at once so the curated checklist is a single round trip. */
export async function addPantryStaplesAction(
  names: string[],
): Promise<{ added: number } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to keep a pantry." };

  const rows = names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((name) => ({
      userId: session.user.id,
      name,
      normalizedName: normalizeIngredientName(name),
    }))
    .filter((r) => r.normalizedName.length > 0);

  if (rows.length === 0) return { added: 0 };

  // The unique index on (user, normalized) makes re-ticking an existing staple a no-op.
  const inserted = await db
    .insert(pantryStaple)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: pantryStaple.id });

  revalidatePath("/pantry");
  return { added: inserted.length };
}

export async function removePantryStapleAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to keep a pantry." };

  await db
    .delete(pantryStaple)
    .where(and(eq(pantryStaple.id, id), eq(pantryStaple.userId, session.user.id)));

  revalidatePath("/pantry");
  return { ok: true };
}
