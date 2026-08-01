import webpush from "web-push";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { cookSession, pushSubscription, scheduledStepEvent, user } from "@/db/schema";
import { cookNotifyChannelsAvailable, sendCookTimerEmail, sendCookTimerSms } from "@/lib/cook-timer-notify";
import { PLAN_LIMITS, type Plan } from "@/lib/entitlements";
import { isMealReminderPayload, type AnyPushPayload } from "@/lib/notifications-types";

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
  const vapidOk = configureWebPush();
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
    const payload = ev.pushPayload as AnyPushPayload;

    // Events carry their recipient directly (meal reminders) or inherit it from
    // the cook session (timers). Preferring the column keeps the cook path
    // unchanged while letting an event exist without a session at all.
    let recipientUserId = ev.userId;
    if (!recipientUserId && ev.cookSessionId) {
      const [session] = await db
        .select({ userId: cookSession.userId })
        .from(cookSession)
        .where(eq(cookSession.id, ev.cookSessionId))
        .limit(1);
      recipientUserId = session?.userId ?? null;
    }
    if (!recipientUserId) {
      await db
        .update(scheduledStepEvent)
        .set({ status: "skipped", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      continue;
    }

    const [u] = await db
      .select({
        email: user.email,
        phoneE164: user.phoneE164,
        notifyCookTimerEmail: user.notifyCookTimerEmail,
        notifyCookTimerSms: user.notifyCookTimerSms,
        plan: user.plan,
      })
      .from(user)
      .where(eq(user.id, recipientUserId))
      .limit(1);

    const subs = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, recipientUserId));

    // Email and SMS renderers are written against the cook payload's fields, so
    // meal reminders go out over web push only until those are generalised too.
    const webPushOnly = isMealReminderPayload(payload);

    const channels = cookNotifyChannelsAvailable();
    let delivered = false;
    let anyChannelAttempted = false;

    if (subs.length > 0 && vapidOk) {
      anyChannelAttempted = true;
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
        delivered = true;
      } catch {
        /* push failed; may still deliver email/SMS */
      }
    }

    if (!webPushOnly && u?.notifyCookTimerEmail && u.email && channels.smtp) {
      anyChannelAttempted = true;
      try {
        if (await sendCookTimerEmail(u.email, payload)) delivered = true;
      } catch {
        /* SMTP send failed */
      }
    }

    // SMS costs real money per message, so it is a paid-plan channel.
    const smsEntitled = PLAN_LIMITS[(u?.plan as Plan) ?? "free"].smsNotifications;
    if (!webPushOnly && smsEntitled && u?.notifyCookTimerSms && u.phoneE164?.trim() && channels.twilio) {
      anyChannelAttempted = true;
      try {
        if (await sendCookTimerSms(u.phoneE164.trim(), payload)) delivered = true;
      } catch {
        /* Twilio error */
      }
    }

    if (!anyChannelAttempted) {
      await db
        .update(scheduledStepEvent)
        .set({ status: "skipped", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      continue;
    }

    if (delivered) {
      await db
        .update(scheduledStepEvent)
        .set({ status: "sent", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
      sent += 1;
    } else {
      await db
        .update(scheduledStepEvent)
        .set({ status: "failed", processedAt: new Date() })
        .where(eq(scheduledStepEvent.id, ev.id));
    }
  }

  return { attempted: due.length, sent, skippedNoVapid: !vapidOk && due.length > 0 };
}
