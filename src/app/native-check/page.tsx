"use client";

import { useEffect, useState } from "react";
import { exactAlarmsAllowed, syncNotifications } from "@/lib/native/notifications";


/**
 * The Phase 0 gate, made visible.
 *
 * One question decides whether the whole native plan is viable: **does
 * Capacitor inject its bridge into a page served from the internet?** In
 * `server.url` mode the WebView loads the deployed site, so if the bridge only
 * reaches files bundled in the binary, every native capability is unreachable
 * and the approach has to change before anything is built on it.
 *
 * Open this inside the shell on a real device of each kind. `ios` or `android`
 * means go. `web` means stop and rethink.
 *
 * Deliberately public and sign-in-free: a device that can't hold a session yet
 * still needs to answer the question, and nothing here is secret.
 */

type Handshake = { minBuild: number; currentBuild: number } | { error: string };

/** Everything the gate looks at, read fresh each tick. */
function readProbe() {
  if (typeof window === "undefined") {
    return { platform: "web", bridge: false, nativeApi: false, origin: "", capacitorKeys: "" };
  }
  const w = window as unknown as Record<string, unknown>;
  const cap = w.Capacitor as
    | { getPlatform?: () => string; isNativePlatform?: () => boolean; platform?: string }
    | undefined;
  return {
    // Ask the injected object directly rather than the bundled wrapper, which
    // may have been evaluated before the runtime got there.
    platform: cap?.getPlatform?.() ?? cap?.platform ?? "web",
    bridge:
      typeof w.androidBridge !== "undefined" ||
      Boolean((w.webkit as { messageHandlers?: Record<string, unknown> })?.messageHandlers?.bridge),
    nativeApi: cap?.isNativePlatform?.() ?? false,
    origin: window.location.origin,
    capacitorKeys: cap ? Object.keys(cap).slice(0, 6).join(", ") : "(no window.Capacitor)",
  };
}

export default function NativeCheckPage() {
  /**
   * Polled, not read once.
   *
   * The native bridge is injected by the runtime around page load, and there is
   * no event to subscribe to. A single read at mount can land before injection
   * and latch "web" forever — a false negative on the one question this page
   * exists to answer, which is far worse than being slow. Polling for a few
   * seconds costs nothing and cannot lie in that direction.
   */
  const [probe, setProbe] = useState(() => readProbe());

  useEffect(() => {
    const id = setInterval(() => setProbe(readProbe()), 250);
    const stop = setTimeout(() => clearInterval(id), 8000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, []);

  const { platform, bridge, nativeApi, origin, capacitorKeys } = probe;
  const [handshake, setHandshake] = useState<Handshake | null>(null);
  const [alarmState, setAlarmState] = useState<string | null>(null);
  const [exact, setExact] = useState<boolean | null>(null);

  useEffect(() => {
    // Proves the shell can also reach the API it will depend on from Phase 1.
    fetch("/api/native/min-version")
      .then((r) => r.json())
      .then(setHandshake)
      .catch((e: unknown) => setHandshake({ error: String(e) }));
  }, []);

  const pass = platform === "ios" || platform === "android";

  /**
   * The Phase 1 proof, on demand.
   *
   * Scheduling is unit-tested, but "the OS actually holds this and rings it
   * while the app is closed" can only be answered by a device. Thirty seconds
   * is long enough to lock the phone and put it down, which is the posture that
   * matters — a notification that only appears in the foreground proves nothing.
   */
  async function scheduleTestAlarm() {
    setAlarmState("scheduling…");
    const fireAt = Date.now() + 30_000;
    const res = await syncNotifications([
      {
        key: `native-check:${fireAt}`,
        title: "Focolare test alarm",
        body: "If you can read this on a locked phone, Phase 1 works.",
        fireAt,
        kind: "cook_timer",
      },
    ]);
    setAlarmState(
      res.skipped
        ? `skipped: ${res.skipped}`
        : `scheduled ${res.scheduled} — lock the phone and wait 30s`,
    );
    setExact(await exactAlarmsAllowed());
  }

  /**
   * `?alarm=1` schedules without a tap.
   *
   * Verifying on a device means driving it from a laptop, and neither
   * simulator lets a script tap a button — iOS has no input command at all.
   * Without this, every re-test needs a human hand, which is how a check stops
   * being run. The permission prompt still requires one tap, once.
   */
  useEffect(() => {
    if (!pass) return;
    if (!new URLSearchParams(window.location.search).has("alarm")) return;
    // Deferred a tick: calling it inline would setState synchronously inside
    // the effect, which React 19 flags as a cascading render.
    const id = setTimeout(() => void scheduleTestAlarm(), 0);
    return () => clearTimeout(id);
    // Runs when the platform resolves. Re-running would only re-schedule the
    // same key, which the reconciler treats as a no-op.
  }, [pass]);


  return (
    <main className="mx-auto max-w-md px-6 py-12 font-sans">
      <h1 className="text-2xl font-semibold text-ink">Native bridge check</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Open this inside the app shell. It answers the one question Phase 0 exists to settle.
      </p>

      <div
        className={`mt-6 rounded-2xl border px-5 py-4 ${
          pass
            ? "border-emerald-300 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Platform</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{platform}</p>
        <p className="mt-2 text-sm text-ink-soft">
          {pass
            ? "The bridge reaches the deployed site. Phase 0 passes — build Phase 1."
            : "Running as a web page. In a browser that is correct. Inside the shell it means the bridge does not reach a remote origin — stop and rethink before building on it."}
        </p>
      </div>

      <dl className="mt-6 space-y-2 text-sm">
        {[
          ["Native message bridge", bridge],
          ["Capacitor.isNativePlatform()", nativeApi],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-4 border-b border-sand pb-2">
            <dt className="text-ink-soft">{label as string}</dt>
            <dd className="font-medium tabular-nums text-ink">{value ? "yes" : "no"}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-b border-sand pb-2">
          <dt className="text-ink-soft">Serving origin</dt>
          <dd className="max-w-[60%] truncate font-medium text-ink">{origin || "…"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-sand pb-2">
          <dt className="text-ink-soft">window.Capacitor</dt>
          <dd className="max-w-[60%] truncate text-right font-medium text-ink">{capacitorKeys}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-sand pb-2">
          <dt className="text-ink-soft">Version handshake</dt>
          <dd className="font-medium tabular-nums text-ink">
            {handshake === null
              ? "…"
              : "error" in handshake
                ? "unreachable"
                : `min ${handshake.minBuild} / current ${handshake.currentBuild}`}
          </dd>
        </div>
        {exact !== null ? (
          <div className="flex justify-between gap-4 border-b border-sand pb-2">
            <dt className="text-ink-soft">Android exact alarms</dt>
            <dd className="font-medium text-ink">{exact ? "allowed" : "BATCHED — will fire late"}</dd>
          </div>
        ) : null}
      </dl>

      {pass ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => void scheduleTestAlarm()}
            className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-[#fff8f0]"
          >
            Schedule a test alarm (30s)
          </button>
          {alarmState ? <p className="mt-3 text-sm text-ink-soft">{alarmState}</p> : null}
          <p className="mt-2 text-xs text-ink-muted">
            Then lock the phone. Ringing with the app closed is the whole point of Phase 1.
          </p>
        </div>
      ) : null}
    </main>
  );
}
