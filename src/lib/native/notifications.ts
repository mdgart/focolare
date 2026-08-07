"use client";

import { LocalNotifications, type PendingResult } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { getPlatform, isNative } from "@/lib/native";
import {
  planNotifications,
  reconcile,
  type DesiredNotification,
  type PlannedNotification,
} from "@/lib/native/local-schedule";

/**
 * The thin shell over the OS scheduler.
 *
 * All the decisions — what to schedule, which ids, what changed — live in
 * `local-schedule.ts`, where they are pure and tested. This file only talks to
 * the platform, so the part that decides whether your dinner burns isn't
 * tangled up with the part that needs a phone to run.
 *
 * Every function here is a no-op on the web. The browser keeps the existing
 * web-push path untouched; this is strictly the native addition.
 */

/**
 * Android groups notifications into channels, and **a channel's importance and
 * sound cannot be changed after it is created** — not by an update, not by
 * reinstalling. Getting this wrong once means every future timer is stuck at
 * whatever importance shipped first, so the two are separated from the start:
 * a timer must interrupt, a reminder should not.
 */
const CHANNELS = [
  {
    id: "focolare-timer",
    name: "Cook timers",
    description: "Rings when a step's timer finishes.",
    importance: 5 as const, // IMPORTANCE_HIGH — heads-up, with sound
    visibility: 1 as const,
    sound: undefined,
    vibration: true,
  },
  {
    id: "focolare-reminder",
    name: "Meal and shopping reminders",
    description: "Says when to start cooking, and what to buy the evening before.",
    importance: 3 as const, // IMPORTANCE_DEFAULT — no heads-up interruption
    visibility: 1 as const,
    vibration: false,
  },
];

let channelsReady = false;

/** Idempotent, but only actually does anything once per install. */
async function ensureChannels(): Promise<void> {
  if (channelsReady || getPlatform() !== "android") return;
  for (const channel of CHANNELS) {
    await LocalNotifications.createChannel(channel);
  }
  channelsReady = true;
}

/**
 * Ask for permission to notify, once.
 *
 * Deliberately *not* called on launch. A permission prompt shown before someone
 * knows what the app does is the one most likely to be refused, and on iOS a
 * refusal is close to permanent — the second ask never appears, only a trip to
 * Settings. Call this when a cook first arms a timer, where the request
 * explains itself.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  if (current.display === "denied") return false;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === "granted";
}

/** What the OS is holding, in the shape the pure reconciler expects. */
async function readPending(): Promise<{ id: number; fireAt: number }[]> {
  const pending: PendingResult = await LocalNotifications.getPending();
  return pending.notifications
    .map((n) => {
      const at = n.schedule?.at;
      return { id: n.id, fireAt: at ? new Date(at).getTime() : 0 };
    })
    .filter((n) => n.fireAt > 0);
}

function toPlatformNotification(p: PlannedNotification) {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    channelId: p.kind === "cook_timer" ? "focolare-timer" : "focolare-reminder",
    schedule: {
      at: new Date(p.fireAt),
      /**
       * Android batches alarms under Doze, which would turn a five-minute egg
       * timer into "some time after five minutes". This is the flag that makes
       * it fire on time; without the exact-alarm permission the OS downgrades
       * it rather than failing, which is why the UI has to be honest about it.
       */
      allowWhileIdle: true,
    },
    /**
     * Breaks through Focus and Do Not Disturb on iOS.
     *
     * The key is `interruptionLevel`, not `iosInterruptionLevel` — the plugin
     * ignores an unknown key and quietly delivers at `active` instead, which
     * waits politely behind a Focus mode. Caught only by reading
     * `interruption-level:` in the device log; nothing surfaces it otherwise.
     * It also needs the entitlement in `ios/App/App/App.entitlements`, without
     * which iOS downgrades it just as silently.
     *
     * `critical` would pierce the silent switch too, but needs an entitlement
     * Apple does not grant cooking apps — so a timer on a silenced phone still
     * relies on the burst and the in-page alarm.
     */
    interruptionLevel: p.kind === "cook_timer" ? ("timeSensitive" as const) : ("active" as const),
    threadIdentifier: p.threadId,
    group: p.threadId,
    /** Carried so a tap can route without another round trip. */
    extra: { key: p.key, url: p.url, kind: p.kind },
  };
}

/**
 * Make the device's schedule match what it should be.
 *
 * Safe to call as often as you like — on mount, on every resume, after any
 * planner change. The reconciler leaves correct alarms untouched, so the common
 * case does no platform work at all.
 *
 * Returns what it did, which is worth logging while this is young: a silently
 * empty schedule is exactly the bug this whole phase exists to prevent.
 */
/**
 * Who is doing the scheduling.
 *
 * Two callers keep the device schedule and each knows only its own half — the
 * cook screen has the running timers, the reminder sync has the planner rows.
 * Whichever ran last would otherwise see the other's alarms as unwanted and
 * cancel them: opening a recipe would delete tomorrow's reminders, refreshing
 * reminders would delete the timer on a simmering pan.
 */
export type SyncScope = "cook" | "reminders";

const OWNED_KEY = (scope: SyncScope) => `focolare.native.owned.${scope}`;

async function readOwned(scope: SyncScope): Promise<number[]> {
  const { value } = await Preferences.get({ key: OWNED_KEY(scope) });
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

async function writeOwned(scope: SyncScope, ids: number[]): Promise<void> {
  await Preferences.set({ key: OWNED_KEY(scope), value: JSON.stringify(ids) });
}

export async function syncNotifications(
  desired: readonly DesiredNotification[],
  scope: SyncScope,
  now: number = Date.now(),
): Promise<{ scheduled: number; cancelled: number; skipped?: string }> {
  if (!isNative()) return { scheduled: 0, cancelled: 0, skipped: "web" };

  const granted = await ensureNotificationPermission();
  if (!granted) return { scheduled: 0, cancelled: 0, skipped: "permission" };

  await ensureChannels();

  const planned = planNotifications(desired, now);
  const { schedule, cancel } = reconcile(planned, await readPending(), await readOwned(scope));

  if (cancel.length > 0) {
    await LocalNotifications.cancel({ notifications: cancel.map((id) => ({ id })) });
  }
  if (schedule.length > 0) {
    await LocalNotifications.schedule({ notifications: schedule.map(toPlatformNotification) });
  }

  // Recorded after the fact so a crash mid-schedule leaves ids unclaimed rather
  // than claimed-but-absent. Unclaimed means "never cancelled by us", which is
  // the harmless direction.
  await writeOwned(scope, planned.map((p) => p.id));

  return { scheduled: schedule.length, cancelled: cancel.length };
}

/**
 * Whether Android will actually honour an exact alarm.
 *
 * Without this permission Doze batches the alarm and a short timer fires late —
 * silently, with no error and no way for the cook to know until the food is
 * ruined. The UI should say so rather than let someone find out the hard way.
 */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (getPlatform() !== "android") return true;
  try {
    const { exact_alarm: exact } = await LocalNotifications.checkExactNotificationSetting();
    return exact === "granted";
  } catch {
    // Older Android has no such setting, and exact alarms simply work.
    return true;
  }
}
