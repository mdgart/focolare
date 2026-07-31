import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";

/**
 * The session for this request, or null.
 *
 * A blocked account is treated as signed out everywhere, which is why the check
 * lives here rather than in individual pages: every server action and page goes
 * through this function, so no route can accidentally miss it. Their rows stay in
 * the database — blocking is reversible and hides content rather than destroying it.
 */
export async function getServerSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return session;

  const [row] = await db
    .select({ blockedAt: userTable.blockedAt })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (row?.blockedAt) return null;
  return session;
}
