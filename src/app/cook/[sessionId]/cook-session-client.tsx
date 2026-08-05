"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  advanceCookStepAction,
  armStepTimerAction,
  completeCookSessionAction,
  pauseStepTimerAction,
  resumeStepTimerAction,
  skipPendingTimersForCookStepAction,
} from "@/actions/cook";
import {
  androidSpeechRecognitionAvailable,
  getAndroidSpeechRecognitionCtor,
  transcriptMeansFinish,
  transcriptMeansNextStep,
  transcriptMeansStartTimer,
} from "@/lib/android-voice-cook";
import {
  advanceWouldStopTimer,
  armStep,
  pauseStep,
  remainingMs as remainingMsFor,
  resumeStep,
  retireStep,
  timerFor,
  type ArmedTimer,
} from "@/lib/cook-timers";
import { createAlarm } from "@/lib/cook-alarm";
import { App as CapApp } from "@capacitor/app";
import { isNative } from "@/lib/native";
import { syncNotifications } from "@/lib/native/notifications";
import { desiredCookNotifications } from "@/lib/native/cook-notifications";
import { IngredientControls } from "./ingredient-controls";
import type { DisplayIngredient, IngredientPrefs } from "@/lib/ingredient-prefs";
import type { MeasureSystem } from "@/lib/unit-convert";
import { formatDurationClock } from "@/lib/format-duration";
import { useWakeLock } from "@/components/useWakeLock";
import { VOICE_COOK_STORAGE_KEY, voiceCookEnabled } from "@/components/VoiceCookSetting";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

type TimelineJson = {
  title: string;
  startMs: number;
  endMs: number;
  durationSeconds: number;
  /** What to actually do — the point of cook mode. */
  instruction: string;
  imageUrl: string | null;
};

const VOICE_COOLDOWN_MS = 1200;

export function CookSessionClient(props: {
  cookSessionId: string;
  recipeTitle: string;
  timeline: TimelineJson[];
  initialStepIndex?: number;
  /** Every pending timer for the session, by the step it belongs to. */
  initialArmed?: ArmedTimer[];
  /** Ingredients as the cook's saved preferences render them. */
  ingredients?: DisplayIngredient[];
  recipeId: string;
  prefs: IngredientPrefs;
  writtenIn: MeasureSystem;
  /** Unscaled, for the "amount I have" anchor. */
  baseIngredients?: { amount?: string; unit?: string; name: string }[];
}) {
  const [idx, setIdx] = useState(() => Math.max(0, props.initialStepIndex ?? 0));
  const [now, setNow] = useState(() => Date.now());
  /**
   * Running timers, by the step each belongs to.
   *
   * A list rather than one value, because steps are navigable now — back, and
   * straight from the all-steps list — and timers are keyed per step on the
   * server, so a cook can genuinely have two going. Holding one would have
   * meant forgetting a live timer on screen while it still fired a
   * notification; cancelling the other on arming would have been worse still,
   * silently killing a bake someone was relying on.
   */
  const [armed, setArmed] = useState<ArmedTimer[]>(() => props.initialArmed ?? []);
  const [pendingArm, setPendingArm] = useState(false);

  /** Set when Next would stop a running timer and we've asked first. */
  const [confirmNext, setConfirmNext] = useState(false);
  /** "steps" while a timer runs is the point: read ahead and get things ready. */
  const [peek, setPeek] = useState<"none" | "steps" | "ingredients">("none");
  /** On by default — the whole point of a cook screen is that you can glance at it. */
  const [keepAwake, setKeepAwake] = useState(true);
  const wakeLock = useWakeLock(keepAwake);
  const step = props.timeline[idx];

  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  const lastVoiceActionAt = useRef(0);

  const canNext = idx < props.timeline.length - 1;
  const isLastStep = !canNext;

  const canNextRef = useRef(canNext);
  const isLastStepRef = useRef(isLastStep);
  canNextRef.current = canNext;
  isLastStepRef.current = isLastStep;

  const idxRef = useRef(idx);
  idxRef.current = idx;

  const cookSessionIdRef = useRef(props.cookSessionId);
  cookSessionIdRef.current = props.cookSessionId;

  const timelineLenRef = useRef(props.timeline.length);
  timelineLenRef.current = props.timeline.length;

  /** The timer on the step being looked at, running or paused. */
  const stepTimer = timerFor(armed, idx);
  const timerArmedAt = stepTimer?.state === "running" ? stepTimer.atMs : null;
  const timerPaused = stepTimer?.state === "paused";

  const timerArmedRef = useRef(false);
  timerArmedRef.current = timerArmedAt != null;

  const stepDurationRef = useRef(0);
  stepDurationRef.current = step?.durationSeconds ?? 0;

  const alarmRef = useRef<ReturnType<typeof createAlarm> | null>(null);
  alarmRef.current ??= createAlarm();
  /** Keyed by step and start time, so a restarted timer can ring again. */
  const rungRef = useRef<Set<string>>(new Set());
  const [justFinished, setJustFinished] = useState<number | null>(null);

  /**
   * Ring when a countdown reaches zero, for whichever step it belongs to.
   *
   * Driven off the same tick that draws the clock, so it fires whether or not
   * the cook is looking at that step — a timer finishing on step 3 matters
   * while you're reading step 4.
   */
  useEffect(() => {
    for (const timer of armed) {
      if (timer.state !== "running") continue;
      const duration = props.timeline[timer.stepIndex]?.durationSeconds ?? 0;
      if (duration <= 0) continue;
      if (remainingMsFor(armed, timer.stepIndex, duration, now) > 0) continue;

      const key = `${timer.stepIndex}:${timer.atMs}`;
      if (rungRef.current.has(key)) continue;
      rungRef.current.add(key);
      alarmRef.current?.ring();
      setJustFinished(timer.stepIndex);
    }
  }, [armed, now, props.timeline]);

  useEffect(() => {
    // Looking at the step that rang is acknowledgement enough.
    if (justFinished === idx) setJustFinished(null);
  }, [justFinished, idx]);



  async function onDone() {
    const res = await completeCookSessionAction(props.cookSessionId);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    try {
      localStorage.removeItem("focolare.dismissCookSessionBanner");
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  /**
   * Start the countdown here first, tell the server after.
   *
   * The timer belongs to the person in the kitchen, not to the network. This
   * used to await the server before touching state, inside a try/finally with
   * no catch — so a dropped connection threw straight past the error branch and
   * "Start timer" did nothing at all, with no message. Standing in a kitchen
   * watching a button not work is the worst version of this screen.
   *
   * Now the clock starts immediately and a failure is reported rather than
   * swallowed. The local timer keeps running either way: it still rings in the
   * page, and once the native shell schedules alarms it rings on a locked phone
   * too. What is lost without the server is the push to a closed app, so that
   * is exactly what the message says.
   */
  const armTimer = useCallback(async () => {
    if (pendingArm || !step || step.durationSeconds <= 0 || timerArmedAt != null) return;
    setPendingArm(true);
    setVoiceHint(null);
    // Browsers only allow sound after a gesture, and zero o'clock isn't one.
    alarmRef.current?.prime();
    setArmed((all) => armStep(all, idx, Date.now()));
    try {
      const res = await armStepTimerAction({ cookSessionId: props.cookSessionId, stepIndex: idx });
      if ("error" in res) setVoiceHint(res.error);
    } catch {
      setVoiceHint(
        "Timer running on this device. We couldn't reach the server, so it won't alert you if you close the app.",
      );
    } finally {
      setPendingArm(false);
    }
  }, [pendingArm, props.cookSessionId, step, timerArmedAt, idx]);

  const armTimerRef = useRef(armTimer);
  armTimerRef.current = armTimer;

  /**
   * Hold the countdown, or pick it back up.
   *
   * The server is told the remaining time so the notification moves with the
   * break — pausing for ten minutes shouldn't leave a push arriving ten minutes
   * early. The row stays pending throughout, so a reload during a break finds
   * the timer paused rather than gone.
   */
  const togglePause = useCallback(async () => {
    if (!step || step.durationSeconds <= 0) return;
    const current = timerFor(armed, idx);
    if (!current) return;

    if (current.state === "running") {
      const left = remainingMsFor(armed, idx, step.durationSeconds, Date.now());
      setArmed((all) => pauseStep(all, idx, step.durationSeconds, Date.now()));
      await pauseStepTimerAction({
        cookSessionId: props.cookSessionId,
        stepIndex: idx,
        remainingSeconds: Math.round(left / 1000),
      });
      return;
    }

    alarmRef.current?.prime();
    setArmed((all) => resumeStep(all, idx, step.durationSeconds, Date.now()));
    await resumeStepTimerAction({ cookSessionId: props.cookSessionId, stepIndex: idx });
  }, [armed, idx, step, props.cookSessionId]);

  /** Back to the full duration — the one thing that legitimately resets a timer. */
  const restartTimer = useCallback(async () => {
    if (!step || step.durationSeconds <= 0) return;
    // A restart gets a fresh start time, so it rings again on its own merits.
    alarmRef.current?.prime();
    setArmed((all) => armStep(all, idx, Date.now()));
    await armStepTimerAction({ cookSessionId: props.cookSessionId, stepIndex: idx });
  }, [idx, step, props.cookSessionId]);

  /**
   * Move on now, reconcile with the server after.
   *
   * This used to await the skip call before advancing, so a failed request left
   * the cook pressing Next and watching the same step stare back — silently,
   * because nothing caught the throw. Moving between steps is the one thing
   * this screen must never refuse to do.
   */
  const goNext = useCallback(async () => {
    setVoiceHint(null);
    const cur = idx;
    // Its server-side event is about to be skipped, so drop only this step's.
    setArmed((all) => retireStep(all, cur));
    setConfirmNext(false);
    const nextIdx = Math.min(cur + 1, props.timeline.length - 1);
    setIdx(nextIdx);
    try {
      await skipPendingTimersForCookStepAction({ cookSessionId: props.cookSessionId, stepIndex: cur });
      await advanceCookStepAction({ cookSessionId: props.cookSessionId, stepIndex: nextIdx });
    } catch {
      // The step moved; only the server's record of it didn't. Phase 3's queue
      // replays this — until then, say so rather than pretend it landed.
      setVoiceHint("You've moved on, but we couldn't save that. Reload when you're back online.");
    }
  }, [idx, props.cookSessionId, props.timeline.length]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  /**
   * Next means "this step is done", which retires its timer.
   *
   * That's right when it's what you meant and quietly destructive when it
   * isn't — a bake you were relying on, gone because you wanted to read the
   * next line. So when a timer is running on this step, ask first, and point at
   * the way to read ahead that leaves it alone.
   */
  const requestNext = useCallback(async () => {
    if (advanceWouldStopTimer(armed, idx, step?.durationSeconds ?? 0, Date.now()) && !confirmNext) {
      setConfirmNext(true);
      // Said out loud too: the whole point of voice is that nobody is looking.
      setVoiceHint("That would stop this step's timer — say next again to confirm.");
      return;
    }
    setConfirmNext(false);
    await goNext();
  }, [armed, idx, step, confirmNext, goNext]);

  const requestNextRef = useRef(requestNext);
  requestNextRef.current = requestNext;

  /**
   * Move to any step without touching the timer.
   *
   * Going back is usually "what did that say again?" while something is on the
   * hob — cancelling the timer for that would be the opposite of helpful. Only
   * `goNext` retires a timer, because finishing a step is what ends it. The
   * index is still persisted, so a reload lands on the step you're actually
   * looking at.
   */
  const goToStep = useCallback(
    async (to: number) => {
      const clamped = Math.min(Math.max(0, to), props.timeline.length - 1);
      if (clamped === idx) return;
      setVoiceHint(null);
      setConfirmNext(false);
      setIdx(clamped);
      await advanceCookStepAction({ cookSessionId: props.cookSessionId, stepIndex: clamped });
    },
    [idx, props.cookSessionId, props.timeline.length],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Keep the phone's own alarms matched to the timers on screen.
   *
   * `armed` already changes at exactly the right moments — arm, pause, resume,
   * restart, retire — so this effect is the entire cook-timer half of the
   * native schedule. No new state, no new events to keep in step.
   *
   * The point of it: these alarms are held by the OS, so the timer rings on a
   * locked phone with the app closed, no server, no cron, and no network. The
   * server's row stays the source of truth and still drives email and SMS; this
   * just gets there first and without asking anyone's permission but the
   * cook's.
   *
   * Also re-run on resume, because the OS can drop or defer pending alarms
   * while an app is backgrounded and an idempotent reconcile is cheap.
   */
  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      void syncNotifications(
        desiredCookNotifications(
          props.cookSessionId,
          props.recipeTitle,
          props.timeline,
          armed,
          Date.now(),
        ),
      );
    };

    sync();
    const listener = CapApp.addListener("resume", sync);
    return () => {
      cancelled = true;
      void listener.then((l) => l.remove());
    };
  }, [armed, props.cookSessionId, props.recipeTitle, props.timeline]);

  useEffect(() => {
    if (!voiceOn) {
      setVoiceHint(null);
      return;
    }
    const Ctor = getAndroidSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceHint("Voice isn’t available in this browser.");
      setVoiceOn(false);
      return;
    }

    let cancelled = false;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";

    function tryVoiceAction(): boolean {
      const t = Date.now();
      if (t - lastVoiceActionAt.current < VOICE_COOLDOWN_MS) return false;
      lastVoiceActionAt.current = t;
      return true;
    }

    rec.onresult = (event: unknown) => {
      const ev = event as {
        resultIndex: number;
        results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } };
      };
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r.isFinal) continue;
        const text = r[0]?.transcript ?? "";

        if (
          stepDurationRef.current > 0 &&
          !timerArmedRef.current &&
          transcriptMeansStartTimer(text) &&
          tryVoiceAction()
        ) {
          void armTimerRef.current();
          return;
        }
        if (transcriptMeansNextStep(text) && canNextRef.current && tryVoiceAction()) {
          void requestNextRef.current();
          return;
        }
        if (transcriptMeansFinish(text) && isLastStepRef.current && tryVoiceAction()) {
          void onDoneRef.current();
          return;
        }
      }
    };

    rec.onerror = (event: unknown) => {
      if (cancelled) return;
      const err = (event as { error?: string }).error ?? "unknown";
      if (err === "aborted" || err === "no-speech") return;
      setVoiceHint(err === "not-allowed" ? "Microphone blocked — allow mic for this site." : `Voice: ${err}`);
    };

    rec.onend = () => {
      if (cancelled || !voiceOnRef.current) return;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };

    try {
      rec.start();
      setVoiceHint(null);
    } catch {
      setVoiceHint("Could not start voice listening.");
      setVoiceOn(false);
    }

    return () => {
      cancelled = true;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [voiceOn]);

  const displayMs = useMemo(() => {
    if (!step || step.durationSeconds <= 0) return 0;
    return remainingMsFor(armed, idx, step.durationSeconds, now);
  }, [step, armed, idx, now]);

  // Opted into in settings; cook mode only shows the button, never the pitch.
  const voiceAllowed =
    voiceCookEnabled(useLocalStorageValue(VOICE_COOK_STORAGE_KEY)) &&
    androidSpeechRecognitionAvailable();

  if (!step) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600 shadow-sm">
        No steps in this session.
      </div>
    );
  }

  const needsTimerStart = step.durationSeconds > 0 && stepTimer == null;

  return (
    <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6 shadow-md ring-1 ring-stone-100 sm:min-h-[50vh] sm:p-8">
      <div>
        {/* Directly under the step counter, at the size of something you're
            meant to use: reading ahead and checking amounts is most of what a
            cook does with a spare five minutes, and both were previously small
            grey pills buried above the Next button. */}
        <div className="mb-4 flex gap-2">
          <PeekButton
            active={peek === "steps"}
            onClick={() => setPeek(peek === "steps" ? "none" : "steps")}
            label="All steps"
            detail={`${props.timeline.length}`}
          />
          {props.ingredients && props.ingredients.length > 0 ? (
            <PeekButton
              active={peek === "ingredients"}
              onClick={() => setPeek(peek === "ingredients" ? "none" : "ingredients")}
              label="Ingredients"
              detail={
                props.prefs.scalePercent !== 100
                  ? `×${props.prefs.scalePercent / 100}`
                  : `${props.ingredients.length}`
              }
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-900/60">
            Step {idx + 1} / {props.timeline.length}
          </p>
          {voiceAllowed ? (
            <button
              type="button"
              role="switch"
              aria-checked={voiceOn}
              onClick={() => setVoiceOn((v) => !v)}
              title={
                voiceOn
                  ? "Listening — say “next”, “start timer” or “finish”"
                  : "Listen for “next”, “start timer” and “finish”"
              }
              className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                voiceOn
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-stone-200 bg-white text-stone-500 hover:text-stone-800"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
                <path d="M4.5 9a5.5 5.5 0 0 0 11 0M10 14.5v3" strokeLinecap="round" />
              </svg>
              {voiceOn ? "Listening" : "Voice"}
            </button>
          ) : null}
          {wakeLock.supported ? (
            <button
              type="button"
              onClick={() => setKeepAwake((v) => !v)}
              aria-pressed={keepAwake}
              title={
                keepAwake
                  ? "Your screen is being kept on while you cook"
                  : "Your screen will dim and lock as usual"
              }
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                keepAwake
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-stone-200 bg-white text-stone-500 hover:text-stone-800"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden="true">
                {keepAwake ? (
                  <>
                    <circle cx="10" cy="10" r="3.25" />
                    <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7" strokeLinecap="round" />
                  </>
                ) : (
                  <path d="M16 11.5A6.5 6.5 0 0 1 8.5 4a6.5 6.5 0 1 0 7.5 7.5z" strokeLinejoin="round" />
                )}
              </svg>
              {keepAwake ? "Screen stays on" : "Screen can sleep"}
            </button>
          ) : null}
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-tight text-stone-900">{step.title}</h1>
        <p className="mt-2 text-sm text-stone-600">{props.recipeTitle}</p>

        {step.imageUrl ? (
          <div className="relative mt-4 aspect-video w-full max-w-md overflow-hidden rounded-xl ring-1 ring-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}

        {step.instruction ? (
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-stone-800 sm:text-lg">
            {step.instruction}
          </p>
        ) : null}
      </div>
      <div className={step.durationSeconds > 0 ? "my-6 text-center sm:my-8" : ""}>
        {step.durationSeconds > 0 ? (
          <>
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-orange-50/80 px-4 py-6">
              <div className="text-3xl font-mono tabular-nums tracking-tight text-amber-950 sm:text-5xl">
                {formatDurationClock(Math.ceil(displayMs / 1000))}
              </div>
            </div>
            <p
              className={`mt-3 text-xs font-medium ${
                displayMs <= 0 && stepTimer ? "text-amber-800" : "text-stone-500"
              }`}
            >
              {needsTimerStart
                ? "Duration for this step — start the timer when you begin."
                : displayMs <= 0 && stepTimer
                  ? "Time's up — this step is done"
                  : timerPaused
                    ? "Paused — it stays here until you pick it up again"
                    : "Time left on this step"}
            </p>
            {needsTimerStart ? (
              <button
                type="button"
                disabled={pendingArm}
                onClick={() => void armTimer()}
                className="mt-4 w-full max-w-xs rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 py-3 text-sm font-semibold text-stone-950 shadow-sm ring-1 ring-amber-800/15 hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingArm ? "Starting…" : "Start timer"}
              </button>
            ) : (
              // A break shouldn't cost you the timer, and starting over is not
              // the same thing as carrying on.
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void togglePause()}
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                >
                  {timerPaused ? "Resume timer" : "Pause timer"}
                </button>
                <button
                  type="button"
                  onClick={() => void restartTimer()}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
                >
                  Restart
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      {peek === "steps" ? (
        <ol className="mb-4 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/70 p-3">
          {props.timeline.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => void goToStep(i)}
                className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white ${
                  i === idx ? "font-semibold text-stone-900" : "text-stone-600"
                }`}
              >
                <span className="w-5 shrink-0 tabular-nums text-xs text-stone-400">{i + 1}</span>
                <span className="min-w-0 flex-1">{s.title}</span>
                {armed.some((a) => a.stepIndex === i) ? (
                  <span
                    className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-900"
                    title="A timer is running on this step"
                  >
                    timing
                  </span>
                ) : null}
                {s.durationSeconds > 0 ? (
                  <span className="shrink-0 text-xs tabular-nums text-stone-400">
                    {Math.round(s.durationSeconds / 60)}m
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {peek === "ingredients" && props.ingredients ? (
        <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
          <IngredientControls
            recipeId={props.recipeId}
            prefs={props.prefs}
            writtenIn={props.writtenIn}
            baseIngredients={props.baseIngredients ?? []}
          />
          <ul className="max-h-56 space-y-1 overflow-y-auto text-sm text-stone-700">
            {props.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.amount ? (
                  <span className="font-semibold tabular-nums">{ing.amount}</span>
                ) : null}
                {ing.unit ? <span className="text-stone-500"> {ing.unit}</span> : null}
                <span className="ml-1.5">{ing.name}</span>
                {ing.needsEye ? (
                  <span className="ml-1.5 text-xs text-stone-400">(as written)</span>
                ) : null}
                {ing.swap ? (
                  <span className="block text-xs text-amber-800">
                    Using {ing.swap.use}
                    {ing.swap.ratio ? <span className="text-stone-500"> — {ing.swap.ratio}</span> : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">
            Amounts only. Step timings stay as written — a bigger batch takes longer in ways no
            ratio predicts.
          </p>
        </div>
      ) : null}

      {voiceHint ? (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {voiceHint}
        </p>
      ) : null}

      {justFinished != null && justFinished !== idx ? (
        <button
          type="button"
          onClick={() => void goToStep(justFinished)}
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-600" />
          </span>
          Step {justFinished + 1}&apos;s timer is done — go there
        </button>
      ) : null}

      {confirmNext ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">
            Moving on stops the timer on this step.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            To read ahead while it keeps running, open <strong>All steps</strong> instead — looking
            around in there leaves every timer alone.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void requestNext()}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              Stop timer & continue
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmNext(false);
                setPeek("steps");
              }}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-50"
            >
              Open all steps
            </button>
            <button
              type="button"
              onClick={() => setConfirmNext(false)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => void goToStep(idx - 1)}
          className="shrink-0 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
          aria-label="Previous step"
        >
          ← Back
        </button>
        {canNext ? (
          <button
            type="button"
            className="flex-1 rounded-xl border border-stone-300 bg-stone-100 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200"
            onClick={() => void requestNext()}
          >
            Next step
          </button>
        ) : (
          <button
            type="button"
            className="flex-1 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 py-3 text-sm font-semibold text-stone-950 shadow-sm ring-1 ring-amber-800/15 hover:from-amber-400 hover:to-amber-500"
            onClick={() => void onDone()}
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}

/** Equal-width so the pair reads as one control, and big enough for wet hands. */
function PeekButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition ${
        props.active
          ? "border-amber-400 bg-amber-50 text-amber-950"
          : "border-stone-300 bg-white text-stone-700 hover:border-amber-300 hover:text-amber-900"
      }`}
    >
      {props.label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums ${
          props.active ? "bg-amber-200/70 text-amber-950" : "bg-stone-100 text-stone-500"
        }`}
      >
        {props.detail}
      </span>
    </button>
  );
}
