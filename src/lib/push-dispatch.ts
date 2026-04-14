import webpush from "web-push";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, pushSubscription, scheduledStepEvent } from "@/db/schema";
import type { PushPayloadV1 } from "@/lib/notifications-types";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function dispatchDuePushEvents(): Promise<{
  attempted: number;
  sent: number;
  skippedNoVapid: boolean;
}> {
  if (!configureWebPush()) {
    return { attempted: 0, sent: 0, skippedNoVapid: true };
  }

  const now = new Date();
  const due = await db
    .select()
    .from(scheduledStepEvent)
    .where(
      and(
        eq(scheduledStepEvent.status, "pending"),
        lte(scheduledStepEvent.fireAt, now),
      ),
    )
    .limit(50);

  let sent = 0;
  for (const ev of due) {
    const payload = ev.pushPayload as PushPayloadV1;
    const [session] = await db
      .select({ userId: cookSession.userId })
      .from(cookSession)
      .where(eq(cookSession.id, ev.cookSessionId))
      .limit(1);
    if (!session) {
      await db
        .update(scheduledStepEvent)
        .set({ status: "skipped", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      continue;
    }

    const subs = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, session.userId));

    if (subs.length === 0) {
      await db
        .update(scheduledStepEvent)
        .set({ status: "skipped", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      continue;
    }

    const body = JSON.stringify(payload);
    try {
      await Promise.all(
        subs.map((s) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 },
          ),
        ),
      );
      await db
        .update(scheduledStepEvent)
        .set({ status: "sent", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      sent += 1;
    } catch {
      await db
        .update(scheduledStepEvent)
        .set({ status: "failed", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
    }
  }

  return { attempted: due.length, sent, skippedNoVapid: false };
}
