/**
 * Cases the cook timers must get right, runnable with `npm run check:timers`.
 *
 * Written against a reported symptom: timers stopping for no visible reason.
 * The bulk of these are therefore *negative* — things that must leave a running
 * timer completely alone. Reading a step, going back, jumping about the
 * all-steps list, finishing some other step, reloading the page: none of it may
 * touch a countdown. Only arming, pausing and finishing that step's own work
 * may, and each of those is something a cook pressed.
 */
import {
  advanceWouldStopTimer,
  armStep,
  armedFromPending,
  pauseStep,
  remainingMs,
  resumeStep,
  retireStep,
  timerFor,
  type ArmedTimer,
} from "@/lib/cook-timers";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const T0 = 1_000_000_000_000;
const MIN = 60_000;
/** A 20-minute bake on step 2, started at T0. */
const BAKE = 20 * 60;
const running = (stepIndex: number, atMs: number): ArmedTimer => ({
  stepIndex,
  state: "running",
  atMs,
});

/* ---------- arming ---------- */

check("arming records the step it belongs to", armStep([], 2, T0), [running(2, T0)]);
check(
  "arming a second step leaves the first running",
  armStep([running(2, T0)], 5, T0 + MIN),
  [running(2, T0), running(5, T0 + MIN)],
);
check(
  "re-arming the same step replaces it — the one legitimate reset",
  armStep([running(2, T0)], 2, T0 + 5 * MIN),
  [running(2, T0 + 5 * MIN)],
);

/* ---------- the reported symptom: nothing else may stop a timer ---------- */

const armed = [running(2, T0), running(5, T0)];

check("reading another step doesn't disturb it", timerFor(armed, 4), null);
check("...and leaves the list untouched", armed.length, 2);
check(
  "finishing a different step leaves this one running",
  retireStep(armed, 5),
  [running(2, T0)],
);
check(
  "finishing a step with no timer changes nothing",
  retireStep(armed, 9),
  armed,
);
check("finishing its own step is what ends it", retireStep(armed, 2), [running(5, T0)]);

// The bug this replaced: any step change wiped the single armed value, so
// stepping away and back showed "Start timer" and re-arming reset the bake.
check(
  "a timer survives navigating away and back",
  timerFor(retireStep(armed, 5), 2),
  running(2, T0),
);

/* ---------- counting down ---------- */

check("an unarmed step shows its full duration", remainingMs([], 2, BAKE, T0), BAKE * 1000);
check("a fresh timer shows the whole thing", remainingMs(armed, 2, BAKE, T0), BAKE * 1000);
check(
  "five minutes in, fifteen remain",
  remainingMs(armed, 2, BAKE, T0 + 5 * MIN),
  15 * MIN,
);
check("it floors at zero rather than going negative", remainingMs(armed, 2, BAKE, T0 + 60 * MIN), 0);
check(
  "another step's timer doesn't drive this step's clock",
  remainingMs([running(5, T0)], 2, BAKE, T0 + 5 * MIN),
  BAKE * 1000,
);

/* ---------- pausing for a break ---------- */

const paused = pauseStep(armed, 2, BAKE, T0 + 5 * MIN);
check("pausing keeps what was left", timerFor(paused, 2), {
  stepIndex: 2,
  state: "paused",
  remainingMs: 15 * MIN,
});
check("pausing one timer leaves the others running", timerFor(paused, 5), running(5, T0));
check(
  "a paused timer holds its number however long the break",
  remainingMs(paused, 2, BAKE, T0 + 90 * MIN),
  15 * MIN,
);
check("pausing an already-paused timer is a no-op", pauseStep(paused, 2, BAKE, T0 + 40 * MIN), paused);
check("pausing a step with no timer changes nothing", pauseStep(armed, 7, BAKE, T0), armed);

const resumed = resumeStep(paused, 2, BAKE, T0 + 60 * MIN);
check(
  "resuming carries the remaining time over rather than restarting",
  remainingMs(resumed, 2, BAKE, T0 + 60 * MIN),
  15 * MIN,
);
check(
  "...and then keeps counting from there",
  remainingMs(resumed, 2, BAKE, T0 + 65 * MIN),
  10 * MIN,
);
check("resuming a running timer is a no-op", resumeStep(armed, 2, BAKE, T0 + 9 * MIN), armed);

/* ---------- surviving a reload ---------- */

const durations = [0, 0, BAKE, 0, 0, 600];

check(
  "a running timer is rebuilt from when its push is due",
  armedFromPending([{ stepIndex: 2, fireAtMs: T0 + BAKE * 1000 }], durations),
  [running(2, T0)],
);
check(
  "...so the countdown resumes mid-flight, not from the top",
  remainingMs(
    armedFromPending([{ stepIndex: 2, fireAtMs: T0 + BAKE * 1000 }], durations),
    2,
    BAKE,
    T0 + 5 * MIN,
  ),
  15 * MIN,
);
check(
  "a paused timer comes back paused, not gone",
  armedFromPending(
    [{ stepIndex: 2, fireAtMs: T0, pausedRemainingSeconds: 15 * 60 }],
    durations,
  ),
  [{ stepIndex: 2, state: "paused", remainingMs: 15 * MIN }],
);
check(
  "several timers all come back",
  armedFromPending(
    [
      { stepIndex: 2, fireAtMs: T0 + BAKE * 1000 },
      { stepIndex: 5, fireAtMs: T0 + 600_000 },
    ],
    durations,
  ).length,
  2,
);
check(
  "an event with no step is ignored rather than crashing",
  armedFromPending([{ stepIndex: null, fireAtMs: T0 }], durations),
  [],
);
check(
  "so is one whose step has no duration",
  armedFromPending([{ stepIndex: 3, fireAtMs: T0 }], durations),
  [],
);

/* ---------- warning before Next throws one away ---------- */

check("advancing off a timing step is worth asking about", advanceWouldStopTimer(armed, 2), true);
check("...including a paused one, which is still set up", advanceWouldStopTimer(paused, 2), true);
check("advancing off an untimed step just goes", advanceWouldStopTimer(armed, 4), false);
check(
  "a timer on another step is not a reason to nag",
  advanceWouldStopTimer([running(5, T0)], 2),
  false,
);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
