"use server";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { channel, recipe, session as sessionTable, user } from "@/db/schema";
import { isAdminEmail, isAdminSessionUser } from "@/lib/admin-auth";
import { getServerSession } from "@/lib/session";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  blockedAt: Date | null;
  blockedReason: string | null;
  createdAt: Date;
  recipeCount: number;
  channelSlug: string | null;
  isAdmin: boolean;
};

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user) return { error: "Unauthorized" };
  if (!(await isAdminSessionUser(session.user))) return { error: "Admins only" };
  return { userId: session.user.id };
}

/** Everyone on the platform, newest first, with the numbers an admin needs to judge. */
export async function listUsersForAdmin(opts?: { q?: string }): Promise<AdminUserRow[]> {
  const guard = await requireAdmin();
  if ("error" in guard) return [];

  const q = opts?.q?.trim();
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      blockedAt: user.blockedAt,
      blockedReason: user.blockedReason,
      createdAt: user.createdAt,
      channelSlug: channel.slug,
      recipeCount: sql<number>`cast((
        select count(*) from ${recipe}
        where ${recipe.channelId} = ${channel.id}
      ) as int)`,
    })
    .from(user)
    .leftJoin(channel, eq(channel.ownerUserId, user.id))
    .where(q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    recipeCount: r.recipeCount ?? 0,
    isAdmin: isAdminEmail(r.email),
  }));
}

export async function blockUserAction(
  targetUserId: string,
  reason: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  if (targetUserId === guard.userId) {
    return { error: "You can't block your own account." };
  }

  const [target] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  if (!target) return { error: "User not found" };

  // ADMIN_EMAILS is environment config, so an admin blocked in the database would
  // still pass the admin check — a confusing half-state. Refuse instead.
  if (isAdminEmail(target.email)) {
    return { error: "That account is an admin. Remove it from ADMIN_EMAILS first." };
  }

  await db
    .update(user)
    .set({ blockedAt: new Date(), blockedReason: reason.trim() || null, updatedAt: new Date() })
    .where(eq(user.id, targetUserId));

  // Drop their sessions so the block takes effect now rather than at expiry.
  await db.delete(sessionTable).where(eq(sessionTable.userId, targetUserId));

  return { ok: true };
}

export async function unblockUserAction(
  targetUserId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  await db
    .update(user)
    .set({ blockedAt: null, blockedReason: null, updatedAt: new Date() })
    .where(eq(user.id, targetUserId));

  return { ok: true };
}
