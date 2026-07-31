import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageEvent, user } from "@/db/schema";

export type Plan = "free" | "pro";
export type AiUsageKind = "recipe" | "image";

/**
 * What each tier gets. This is the only place limits live — a payment provider
 * only ever needs to flip `user.plan`.
 *
 * The free tier is deliberately generous on recipe AI: turning a pasted recipe into
 * working timers is the moment that sells the product, so people must be able to
 * feel it before paying. Image generation is metered tighter because each call has
 * a real per-image cost, and SMS is paid-only because every message costs money to send.
 */
export const PLAN_LIMITS: Record<
  Plan,
  { aiRecipesPerMonth: number; aiImagesPerMonth: number; smsNotifications: boolean }
> = {
  free: { aiRecipesPerMonth: 5, aiImagesPerMonth: 1, smsNotifications: false },
  pro: { aiRecipesPerMonth: 100, aiImagesPerMonth: 30, smsNotifications: true },
};

/** Quotas run on calendar months in UTC. */
function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getPlan(userId: string): Promise<Plan> {
  const [row] = await db.select({ plan: user.plan }).from(user).where(eq(user.id, userId)).limit(1);
  return (row?.plan as Plan) ?? "free";
}

export async function countAiUsageThisMonth(userId: string, kind: AiUsageKind): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(aiUsageEvent)
    .where(
      and(
        eq(aiUsageEvent.userId, userId),
        eq(aiUsageEvent.kind, kind),
        gte(aiUsageEvent.createdAt, startOfMonth()),
      ),
    );
  return row?.n ?? 0;
}

export type AiQuota = {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
};

export async function getAiQuota(userId: string, kind: AiUsageKind): Promise<AiQuota> {
  const plan = await getPlan(userId);
  const limit =
    kind === "image" ? PLAN_LIMITS[plan].aiImagesPerMonth : PLAN_LIMITS[plan].aiRecipesPerMonth;
  const used = await countAiUsageThisMonth(userId, kind);
  const remaining = Math.max(0, limit - used);
  return { plan, used, limit, remaining, allowed: remaining > 0 };
}

/** Record a successful call. Only ever called after the AI actually returned something. */
export async function recordAiUsage(userId: string, kind: AiUsageKind): Promise<void> {
  await db.insert(aiUsageEvent).values({ userId, kind });
}

export function quotaExceededMessage(kind: AiUsageKind, quota: AiQuota): string {
  const what = kind === "image" ? "AI photo" : "AI recipe";
  if (quota.plan === "pro") {
    return `You've used all ${quota.limit} ${what} credits this month. They reset on the 1st.`;
  }
  return `You've used your ${quota.limit} free ${what} credit${quota.limit === 1 ? "" : "s"} this month. They reset on the 1st — or upgrade for more.`;
}

/** Whether this user may receive cook-timer SMS. */
export async function canUseSmsNotifications(userId: string): Promise<boolean> {
  return PLAN_LIMITS[await getPlan(userId)].smsNotifications;
}
