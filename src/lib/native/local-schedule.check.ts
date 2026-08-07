/**
 * Rules the on-device schedule must not get wrong, via `npm run check:schedule`.
 *
 * These decide whether a timer rings while a phone is locked in a kitchen, and
 * every failure mode here is silent: iOS drops pending notifications past 64
 * without a word, and a past-dated Android alarm can fire the instant the app
 * opens. None of it announces itself on a developer's desk, which is exactly
 * why it belongs in a check rather than in a device test done once.
 */
import {
  burstFor,
  planNotifications,
  reconcile,
  SCHEDULE_BUDGET,
  stableIdFor,
  type DesiredNotification,
} from "@/lib/native/local-schedule";
import { cookTimerKey, desiredCookNotifications } from "@/lib/native/cook-notifications";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const NOW = Date.UTC(2026, 7, 5, 12, 0, 0);
const MIN = 60_000;

const timer = (key: string, inMinutes: number): DesiredNotification => ({
  key,
  title: "Timer done",
  body: "Step 3",
  fireAt: NOW + inMinutes * MIN,
  kind: "cook_timer",
});
const meal = (key: string, inMinutes: number): DesiredNotification => ({
  key,
  title: "Start cooking",
  body: "Carbonara",
  fireAt: NOW + inMinutes * MIN,
  kind: "meal_reminder",
});

/* ---------- ids ---------- */

check("the same key always gives the same id", stableIdFor("plan:1:x"), stableIdFor("plan:1:x"));
check("different keys differ", stableIdFor("a") === stableIdFor("b"), false);
check("ids fit in a signed 32-bit int", stableIdFor("x".repeat(200)) < 2 ** 31, true);
check("...and are never negative", stableIdFor("ÿþý") >= 0, true);

/* ---------- what gets scheduled ---------- */

check(
  "a past alarm is dropped, not scheduled",
  planNotifications([timer("gone", -5)], NOW).length,
  0,
);
check(
  "beyond the horizon belongs to the server",
  planNotifications([meal("far", 60 * 24 * 20)], NOW).length,
  0,
);

// A cook timer is worth three attempts; iOS won't ring a silenced phone once.
check("a cook timer becomes a burst of three", burstFor("cook_timer").length, 3);
check("a reminder stays a single alert", burstFor("meal_reminder").length, 1);
check(
  "...and the burst is spaced, not simultaneous",
  planNotifications([timer("t", 10)], NOW).map((p) => p.fireAt - NOW - 10 * MIN),
  [0, 30_000, 90_000],
);
check(
  "a burst shares one thread so it groups",
  new Set(planNotifications([timer("t", 10)], NOW).map((p) => p.threadId)).size,
  1,
);
check(
  "...but each alert still needs its own id",
  new Set(planNotifications([timer("t", 10)], NOW).map((p) => p.id)).size,
  3,
);

/* ---------- priority under pressure ---------- */

// The rule that matters: when the budget runs out, reminders lose, not timers.
const crowded = [
  ...Array.from({ length: 30 }, (_, i) => meal(`m${i}`, 60 + i)),
  timer("late-timer", 600),
];
const plannedCrowded = planNotifications(crowded, NOW);
check(
  "the cook timer survives a flood of reminders",
  plannedCrowded.some((p) => p.key === "late-timer"),
  true,
);
check("...and the budget is respected", plannedCrowded.length <= SCHEDULE_BUDGET, true);
check(
  "...well under the iOS cliff of 64",
  planNotifications(
    Array.from({ length: 200 }, (_, i) => timer(`t${i}`, i + 1)),
    NOW,
  ).length <= SCHEDULE_BUDGET,
  true,
);
check(
  "a burst is never left half-scheduled",
  planNotifications(
    Array.from({ length: 200 }, (_, i) => timer(`t${i}`, i + 1)),
    NOW,
  ).length % 3,
  0,
);
check(
  "sooner comes before later within a kind",
  planNotifications([meal("later", 200), meal("sooner", 20)], NOW).map((p) => p.key),
  ["sooner", "later"],
);

/* ---------- reconciling with the device ---------- */

const planned = planNotifications([timer("t", 10)], NOW);

check(
  "nothing pending means schedule everything",
  reconcile(planned, []).schedule.length,
  3,
);
check(
  "already correct means do nothing — safe to run on every resume",
  reconcile(planned, planned.map((p) => ({ id: p.id, fireAt: p.fireAt }))),
  { schedule: [], cancel: [] },
);
check(
  "a moved fire time is rescheduled",
  reconcile(planned, planned.map((p) => ({ id: p.id, fireAt: p.fireAt + 60_000 }))).schedule.length,
  3,
);
check(
  "...but sub-second drift is not churn",
  reconcile(planned, planned.map((p) => ({ id: p.id, fireAt: p.fireAt + 400 }))).schedule.length,
  0,
);
check(
  "a notification no longer wanted is cancelled — if this caller owns it",
  reconcile([], [{ id: 999, fireAt: NOW + MIN }], [999]).cancel,
  [999],
);
check(
  "...and one still wanted is not",
  reconcile(
    planned,
    [
      { id: planned[0]!.id, fireAt: planned[0]!.fireAt },
      { id: 999, fireAt: NOW + MIN },
    ],
    [planned[0]!.id, 999],
  ).cancel,
  [999],
);

// The collision that would otherwise delete someone's dinner: two callers each
// sync their own half of the schedule, and neither may touch the other's.
check(
  "another caller's alarms are never cancelled",
  reconcile([], [{ id: 4242, fireAt: NOW + MIN }], [999]).cancel,
  [],
);
check(
  "...and with no ownership stated, nothing is cancelled at all",
  reconcile([], [{ id: 4242, fireAt: NOW + MIN }]).cancel,
  [],
);
check(
  "a caller still cancels its own while leaving others alone",
  reconcile(
    [],
    [
      { id: 111, fireAt: NOW + MIN },
      { id: 222, fireAt: NOW + MIN },
    ],
    [111],
  ).cancel,
  [111],
);

/* ---------- turning cook timers into alarms ---------- */

const TL = [
  { durationSeconds: 0, label: "Chop the onion" },
  { durationSeconds: 600, label: "Simmer gently" },
  { durationSeconds: 300, label: "Rest off the heat" },
];
const cookDesired = (armed: Parameters<typeof desiredCookNotifications>[3], now = NOW) =>
  desiredCookNotifications("sesh", "Ragu", TL, armed, now);

check(
  "a running timer becomes one alarm",
  cookDesired([{ stepIndex: 1, state: "running", atMs: NOW }]).map((d) => d.fireAt - NOW),
  [600_000],
);
// The one people get wrong: a break should not be interrupted by the thing
// they paused to avoid.
check(
  "a paused timer schedules nothing",
  cookDesired([{ stepIndex: 1, state: "paused", remainingMs: 300_000 }]).length,
  0,
);
check(
  "a step with no duration schedules nothing",
  cookDesired([{ stepIndex: 0, state: "running", atMs: NOW }]).length,
  0,
);
check(
  "an already-elapsed timer schedules nothing",
  cookDesired([{ stepIndex: 1, state: "running", atMs: NOW - 700_000 }]).length,
  0,
);
check(
  "the body names the step, not the timer",
  cookDesired([{ stepIndex: 2, state: "running", atMs: NOW }])[0]?.body,
  "Rest off the heat",
);
check(
  "the key is stable and step-scoped",
  cookTimerKey("sesh", 2),
  "sesh:step:2",
);
check(
  "two running timers become two alarms",
  cookDesired([
    { stepIndex: 1, state: "running", atMs: NOW },
    { stepIndex: 2, state: "running", atMs: NOW },
  ]).length,
  2,
);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
