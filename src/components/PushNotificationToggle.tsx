"use client";

import { useCallback, useEffect, useState } from "react";

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "working";

/** VAPID keys travel as URL-safe base64; the subscribe call wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  /** Reads the browser's current state without touching React state. */
  const currentState = useCallback(async (): Promise<State> => {
    if (!supported || !vapidPublicKey) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return sub ? "on" : "off";
    } catch {
      return "off";
    }
  }, [supported, vapidPublicKey]);

  const refresh = useCallback(async () => {
    setState(await currentState());
  }, [currentState]);

  useEffect(() => {
    let cancelled = false;
    // Resolved in a callback rather than synchronously in the effect body, which
    // would cascade renders (react-hooks/set-state-in-effect).
    void currentState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [currentState]);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      // Registering here rather than on every page load means the worker is only
      // installed for people who actually want notifications.
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as BufferSource,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        // Don't leave a browser subscription the server doesn't know about.
        await sub.unsubscribe();
        setError("Couldn't save the subscription — try again.");
        setState("off");
        return;
      }
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable notifications.");
      setState("off");
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/register?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Couldn't turn notifications off.");
      await refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Push notifications</p>
          <p className="text-xs text-ink-muted">
            Alerts on this device even when Focolare isn&apos;t open. Free on every plan.
          </p>
        </div>

        {state === "checking" ? (
          <span className="text-sm text-ink-muted">Checking…</span>
        ) : state === "unsupported" ? (
          <span className="text-sm text-ink-muted">Not available here</span>
        ) : state === "denied" ? (
          <span className="text-sm text-ink-muted">Blocked in browser settings</span>
        ) : (
          <button
            type="button"
            disabled={state === "working"}
            onClick={() => void (state === "on" ? disable() : enable())}
            className={
              state === "on"
                ? "rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-60"
                : "btn btn-primary !px-5 !py-2 text-sm disabled:opacity-60"
            }
          >
            {state === "working" ? "Working…" : state === "on" ? "Turn off" : "Enable on this device"}
          </button>
        )}
      </div>

      {state === "on" ? (
        <p className="text-xs text-sage">Enabled on this device.</p>
      ) : state === "denied" ? (
        <p className="text-xs text-ink-muted">
          Your browser is blocking notifications for this site. Allow them in the address-bar site
          settings, then reload.
        </p>
      ) : state === "unsupported" && !vapidPublicKey ? (
        <p className="text-xs text-ink-muted">
          Push isn&apos;t configured on this server (VAPID keys missing).
        </p>
      ) : null}

      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
