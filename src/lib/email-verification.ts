import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { smtpConfigured } from "@/lib/mailer";

/**
 * Publishing requires a confirmed email address; browsing, saving, cooking and
 * keeping private recipes do not. That blocks drive-by spam — the cheapest
 * deterrent available — without putting a wall in front of someone's first visit.
 *
 * Only enforced when SMTP is actually configured. Otherwise no verification mail
 * can be sent, and enforcing it would lock every new account out of publishing
 * with no way to fix it.
 */
export function verificationEnforced(): boolean {
  return smtpConfigured();
}

export const UNVERIFIED_PUBLISH_MESSAGE =
  "Confirm your email address before publishing. Check your inbox for the link, or resend it from Account settings. You can keep working on this as a draft in the meantime.";

export async function isEmailVerified(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ emailVerified: userTable.emailVerified })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return Boolean(row?.emailVerified);
}

/** Null when the user may publish, or an error message explaining why not. */
export async function blockedFromPublishing(userId: string): Promise<string | null> {
  if (!verificationEnforced()) return null;
  if (await isEmailVerified(userId)) return null;
  return UNVERIFIED_PUBLISH_MESSAGE;
}
