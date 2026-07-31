/**
 * Set an account's plan from the command line.
 *
 * The admin UI at /admin/users does the same thing, but this covers the
 * bootstrap case — comping an account before that page is deployed, or before
 * you have an admin account to sign in with.
 *
 * Usage:
 *   npm run db:set-plan -- someone@example.com pro
 *   npm run db:set-plan -- someone@example.com free
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { user } from "./schema";
import { PLAN_LIMITS } from "@/lib/entitlements";

async function main() {
  const [email, plan] = process.argv.slice(2);

  if (!email || (plan !== "pro" && plan !== "free")) {
    console.error("Usage: npm run db:set-plan -- <email> <pro|free>");
    process.exitCode = 1;
    return;
  }

  const [target] = await db
    .select({ id: user.id, email: user.email, plan: user.plan })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);

  if (!target) {
    console.error(`No account found for ${email}. They need to sign up first.`);
    process.exitCode = 1;
    return;
  }

  await db.update(user).set({ plan, updatedAt: new Date() }).where(eq(user.id, target.id));

  const limits = PLAN_LIMITS[plan];
  console.log(`${target.email}: ${target.plan} -> ${plan}`);
  console.log(
    `  ${limits.aiRecipesPerMonth} AI recipes/month, ${limits.aiImagesPerMonth} AI images/month, SMS ${limits.smsNotifications ? "on" : "off"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
