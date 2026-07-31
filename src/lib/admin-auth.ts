import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";

/** Parses `ADMIN_EMAILS` (comma/semicolon-separated, quotes stripped, case-insensitive). */
export function parseAdminEmailList(): string[] {
  let raw = (process.env.ADMIN_EMAILS ?? "").trim();
  if (!raw) return [];
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().replace(/^['"]+|['"]+$/g, "").toLowerCase())
    .filter(Boolean);
}

/** True when `email` is listed in `ADMIN_EMAILS`. */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const list = parseAdminEmailList();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

type SessionUserLike = { id: string; email?: string | null };

/**
 * Admin check for the signed-in user: session email first, then `user.email` from the DB
 * (covers empty session email or env formatting issues like quoted `ADMIN_EMAILS`).
 */
export async function isAdminSessionUser(user: SessionUserLike | undefined | null): Promise<boolean> {
  if (!user?.id) return false;
  if (isAdminEmail(user.email)) return true;
  const [row] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);
  return isAdminEmail(row?.email);
}
