"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  advanceCookStepAction,
  armStepTimerAction,
  completeCookSessionAction,
  skipPendingTimersForCookStepAction,
} from "@/actions/cook";
import {
  androidSpeechRecognitionAvailable,
  getAndroidSpeechRecognitionCtor,
  transcriptMeansFinish,
  transcriptMeansNextStep,
  transcriptMeansStartTimer,
} from "@/lib/android-voice-cook";
import { formatDurationClock } from "@/lib/format-duration";
import { useWakeLock } from "@/components/useWakeLock";

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
  initialTimerArmedAtMs?: number | null;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, props.initialStepIndex ?? 0));
  const [now, setNow] = useState(() => Date.now());
  const [timerArmedAt, setTimerArmedAt] = useState<number | null>(() => props.initialTimerArmedAtMs ?? null);
  const [pendingArm, setPendingArm] = useState(false);
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

  const timerArmedRef = useRef(false);
  timerArmedRef.current = timerArmedAt != null;

  const stepDurationRef = useRef(0);
  stepDurationRef.current = step?.durationSeconds ?? 0;

  useEffect(() => {
    setTimerArmedAt(null);
  }, [idx]);

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

  const armTimer = useCallback(async () => {
    if (pendingArm || !step || step.durationSeconds <= 0 || timerArmedAt != null) return;
    setPendingArm(true);
    setVoiceHint(null);
    try {
      const res = await armStepTimerAction({ cookSessionId: props.cookSessionId, stepIndex: idx });
      if ("error" in res) {
        setVoiceHint(res.error);
        return;
      }
      setTimerArmedAt(Date.now());
    } finally {
      setPendingArm(false);
    }
  }, [pendingArm, props.cookSessionId, step, timerArmedAt, idx]);

  const armTimerRef = useRef(armTimer);
  armTimerRef.current = armTimer;

  const goNext = useCallback(async () => {
    setVoiceHint(null);
    const cur = idx;
    await skipPendingTimersForCookStepAction({ cookSessionId: props.cookSessionId, stepIndex: cur });
    const nextIdx = Math.min(cur + 1, props.timeline.length - 1);
    setIdx(nextIdx);
    await advanceCookStepAction({ cookSessionId: props.cookSessionId, stepIndex: nextIdx });
  }, [idx, props.cookSessionId, props.timeline.length]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

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
          void goNextRef.current();
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
    const durationMs = step.durationSeconds * 1000;
    if (timerArmedAt == null) return durationMs;
    return Math.max(0, durationMs - (now - timerArmedAt));
  }, [step, now, timerArmedAt]);

  const showVoiceUi = androidSpeechRecognitionAvailable();

  if (!step) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600 shadow-sm">
        No steps in this session.
      </div>
    );
  }

  const needsTimerStart = step.durationSeconds > 0 && timerArmedAt == null;

  return (
    <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6 shadow-md ring-1 ring-stone-100 sm:min-h-[50vh] sm:p-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-900/60">
            Step {idx + 1} / {props.timeline.length}
          </p>
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
            <p className="mt-3 text-xs font-medium text-stone-500">
              {needsTimerStart ? "Duration for this step — start the timer when you begin." : "Time left on this step"}
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
            ) : null}
          </>
        ) : null}
      </div>

      {showVoiceUi ? (
        <div className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 text-left text-sm text-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-emerald-950">Voice (Android)</span>
            <button
              type="button"
              role="switch"
              aria-checked={voiceOn}
              aria-label={voiceOn ? "Turn off voice commands" : "Turn on voice commands"}
              onClick={() => setVoiceOn((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                voiceOn ? "bg-emerald-600" : "bg-stone-300"
              }`}
            >
              <span
                className={`pointer-events-none absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  voiceOn ? "left-[calc(100%-1.625rem)]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs leading-snug text-stone-600">
            {voiceOn ? (
              <>
                <span className="font-medium text-emerald-900">Listening.</span>{" "}
                {needsTimerStart ? (
                  <>
                    Say <q className="font-semibold text-stone-800">start timer</q> (or <q className="font-semibold text-stone-800">go</q>) to begin the countdown.{" "}
                  </>
                ) : null}
                {canNext ? (
                  <>
                    Say <q className="font-semibold text-stone-800">next step</q> (or &ldquo;next&rdquo;, &ldquo;continue&rdquo;) to advance.
                  </>
                ) : (
                  <>
                    Say <q className="font-semibold text-stone-800">finish</q> or <q className="font-semibold text-stone-800">done</q> to complete.
                  </>
                )}
              </>
            ) : (
              "Turn on to use the microphone. Works in Chrome on Android; speak clearly after the tone."
            )}
          </p>
          {voiceHint ? <p className="mt-2 text-xs text-amber-900">{voiceHint}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {canNext ? (
          <button
            type="button"
            className="flex-1 rounded-xl border border-stone-300 bg-stone-100 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200"
            onClick={() => void goNext()}
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
