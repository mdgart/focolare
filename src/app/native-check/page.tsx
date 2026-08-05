"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { useNativePlatform } from "@/lib/native";

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

export default function NativeCheckPage() {
  // Read through useSyncExternalStore, not an effect: these differ between
  // server and client, and setting them from an effect trips React 19's
  // cascading-render rule. None of them change while the app runs.
  const noop = () => () => {};
  const platform = useNativePlatform();
  /**
   * The *native* message bridge, not `window.Capacitor`.
   *
   * Importing `@capacitor/core` defines `window.Capacitor` in an ordinary
   * browser too, so checking for it reports "yes" on the web and would read
   * like a pass. These two handlers are injected by the native runtime and
   * exist nowhere else — which is exactly the question Phase 0 is asking.
   */
  const bridge = useSyncExternalStore(
    noop,
    () =>
      typeof (window as { androidBridge?: unknown }).androidBridge !== "undefined" ||
      Boolean(
        (window as { webkit?: { messageHandlers?: Record<string, unknown> } }).webkit
          ?.messageHandlers?.bridge,
      ),
    () => false,
  );
  const nativeApi = useSyncExternalStore(noop, () => Capacitor.isNativePlatform(), () => false);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");

  const [handshake, setHandshake] = useState<Handshake | null>(null);

  useEffect(() => {
    // Proves the shell can also reach the API it will depend on from Phase 1.
    // setState here is inside an async callback, which the rule allows.
    fetch("/api/native/min-version")
      .then((r) => r.json())
      .then(setHandshake)
      .catch((e: unknown) => setHandshake({ error: String(e) }));
  }, []);

  const pass = platform === "ios" || platform === "android";

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
          <dt className="text-ink-soft">Version handshake</dt>
          <dd className="font-medium tabular-nums text-ink">
            {handshake === null
              ? "…"
              : "error" in handshake
                ? "unreachable"
                : `min ${handshake.minBuild} / current ${handshake.currentBuild}`}
          </dd>
        </div>
      </dl>
    </main>
  );
}
