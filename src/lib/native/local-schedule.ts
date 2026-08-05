/**
 * What the phone should have scheduled, worked out without touching the phone.
 *
 * The server's `scheduled_step_event` table stays the source of truth — it is
 * durable, it drives email and SMS, and `armedFromPending()` already rebuilds
 * the cook screen from it. This adds a **parallel on-device schedule** that
 * fires first and locally, so a timer rings with no server, no cron, and no
 * network. That is the entire reason the native shell exists.
 *
 * Everything here is pure: what should be scheduled, which ids they get, and
 * what changed since last time. The Capacitor calls live in the caller, so the
 * rules that decide whether your egg timer survives can be tested without a
 * phone in the room.
 */

export type NotificationKind = "cook_timer" | "meal_reminder" | "shopping_reminder";

export type DesiredNotification = {
  /** The server's `idempotencyKey` — stable across reschedules and reloads. */
  key: string;
  title: string;
  body: string;
  /** Epoch ms. */
  fireAt: number;
  kind: NotificationKind;
  /** Where tapping it should land. */
  url?: string;
};

/** A notification the OS is currently holding, as `getPending()` reports it. */
export type PendingNotification = { id: number; fireAt: number };

/**
 * iOS keeps only the **64 soonest** pending local notifications and silently
 * drops the rest — no error, no warning, just a timer that never rings. Staying
 * well under leaves room for the burst each cook timer schedules (see
 * `burstFor`) and for anything scheduled between reconciles.
 */
export const IOS_PENDING_LIMIT = 64;
export const SCHEDULE_BUDGET = 55;

/** Meal reminders beyond this are the server's job, not the phone's. */
export const HORIZON_DAYS = 14;

/**
 * Cook timers outrank everything.
 *
 * A missed meal reminder is a mild annoyance; a missed cook timer is a burnt
 * dinner and the reason someone installed this. When the budget is tight, the
 * far-future reminders are the ones to lose.
 */
const KIND_RANK: Record<NotificationKind, number> = {
  cook_timer: 0,
  meal_reminder: 1,
  shopping_reminder: 2,
};

/**
 * A stable 32-bit id derived from the key.
 *
 * Both platforms identify a pending notification by integer, while everything
 * else in this codebase identifies it by `idempotencyKey`. Deriving one from
 * the other means the mapping survives a reinstall, a reload, and a cleared
 * Preferences store — nothing has to be remembered for cancellation to work.
 *
 * FNV-1a, then forced positive and kept under 2^31 because Android ids are
 * signed ints. Collisions are possible in principle; with tens of pending
 * notifications the odds are negligible, and the cost of one would be a single
 * replaced notification rather than anything corrupt.
 */
export function stableIdFor(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 0x7fffffff;
}

/**
 * When one alarm should actually be several.
 *
 * iOS will not ring through a silenced switch or a Focus mode for an ordinary
 * notification, and `critical` needs an entitlement Apple does not hand out for
 * cooking apps. A short burst is the honest mitigation: if the first is missed
 * because the phone was face-down in a bag, the second or third lands while the
 * cook is looking. They share a thread so the OS groups them instead of
 * stacking three separate rows.
 *
 * Reminders get one. Nobody needs their shopping list three times.
 */
export function burstFor(kind: NotificationKind): number[] {
  return kind === "cook_timer" ? [0, 30_000, 90_000] : [0];
}

/** One entry as it should exist on the device. */
export type PlannedNotification = {
  id: number;
  key: string;
  title: string;
  body: string;
  fireAt: number;
  kind: NotificationKind;
  url?: string;
  /** Groups a burst under one heading rather than three rows. */
  threadId: string;
};

/**
 * Expand what we want into what the OS should hold, in priority order.
 *
 * Anything already in the past is dropped rather than scheduled: an alarm for a
 * moment that has gone is noise at best, and on Android a past `allowWhileIdle`
 * alarm can fire immediately, which means a phone that buzzes about last
 * night's dinner the moment you open the app.
 */
export function planNotifications(
  desired: readonly DesiredNotification[],
  now: number,
  budget: number = SCHEDULE_BUDGET,
): PlannedNotification[] {
  const horizon = now + HORIZON_DAYS * 24 * 60 * 60 * 1000;

  const ordered = [...desired]
    .filter((d) => d.fireAt > now && d.fireAt <= horizon)
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.fireAt - b.fireAt);

  const planned: PlannedNotification[] = [];
  for (const d of ordered) {
    const offsets = burstFor(d.kind);
    // All or nothing per notification: half a burst is a timer that rings once
    // quietly and then never again, which is worse than a clean drop.
    if (planned.length + offsets.length > budget) continue;
    for (const offset of offsets) {
      planned.push({
        id: stableIdFor(offset === 0 ? d.key : `${d.key}:+${offset}`),
        key: d.key,
        title: d.title,
        body: d.body,
        fireAt: d.fireAt + offset,
        kind: d.kind,
        url: d.url,
        threadId: d.key,
      });
    }
  }
  return planned;
}

/**
 * The difference between what the phone holds and what it should hold.
 *
 * Idempotent on purpose: this runs on mount, on every app resume, and after
 * every planner change, so it has to be safe to call constantly. An entry whose
 * id and fire time both already match is left alone — rescheduling it would
 * churn the OS queue for nothing, and on Android reposting an alarm can reset
 * its exact-alarm allowance.
 */
export function reconcile(
  planned: readonly PlannedNotification[],
  pending: readonly PendingNotification[],
): { schedule: PlannedNotification[]; cancel: number[] } {
  const pendingById = new Map(pending.map((p) => [p.id, p.fireAt]));
  const plannedById = new Map(planned.map((p) => [p.id, p]));

  const schedule = planned.filter((p) => {
    const existing = pendingById.get(p.id);
    // Second-level tolerance: platforms round fire times, and a millisecond of
    // drift is not a reason to tear down and rebuild an alarm.
    return existing === undefined || Math.abs(existing - p.fireAt) > 1000;
  });

  const cancel = pending.filter((p) => !plannedById.has(p.id)).map((p) => p.id);

  return { schedule, cancel };
}
