"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { isNative } from "@/lib/native";

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };

/**
 * Keeps the screen awake while cooking.
 *
 * A phone propped against the flour bag locking itself every thirty seconds is
 * the difference between a usable cook screen and one you have to keep poking
 * with wet hands.
 *
 * The browser drops the lock whenever the tab is hidden, so it has to be
 * re-acquired on the way back — otherwise it silently stops working the first
 * time someone checks a message. Some browsers don't implement the API at all,
 * hence `supported`.
 *
 * **WKWebView is one of those.** The Screen Wake Lock API simply isn't there,
 * so on iOS the cook screen dimmed and locked mid-recipe with nothing to
 * explain why — the worst moment for it, since the reason the screen is propped
 * up is that your hands are covered in flour. In the native shell this uses the
 * OS call instead, which works on both platforms.
 */
export function useWakeLock(enabled: boolean) {
  // Read once on the client rather than syncing through an effect; whether the
  // browser has the API never changes for the life of the page.
  const supported = useSyncExternalStore(
    () => () => {},
    // The native shell can always do this, whatever the WebView lacks.
    () => isNative() || (typeof navigator !== "undefined" && "wakeLock" in navigator),
    () => false,
  );
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const release = useCallback(async () => {
    if (isNative()) {
      setActive(false);
      try {
        await KeepAwake.allowSleep();
      } catch {
        /* nothing was held */
      }
      return;
    }
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        /* already gone */
      }
    }
  }, []);

  const acquire = useCallback(async () => {
    if (isNative()) {
      try {
        await KeepAwake.keepAwake();
        setActive(true);
      } catch {
        setActive(false);
      }
      return;
    }
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (sentinelRef.current && !sentinelRef.current.released) return;
    try {
      const nav = navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      sentinelRef.current = await nav.wakeLock.request("screen");
      setActive(true);
    } catch {
      // Denied (often because the tab isn't visible) — not worth surfacing.
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      void Promise.resolve().then(release);
      return;
    }
    // Deferred to a callback so the effect body doesn't set state synchronously.
    void Promise.resolve().then(acquire);

    // The lock is dropped on tab switch, screen off, or app background.
    // setActive only ever runs from these async callbacks, never in the effect body.
    function onVisibility() {
      if (document.visibilityState === "visible") void acquire();
      else void Promise.resolve().then(() => setActive(false));
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [enabled, acquire, release]);

  return { supported, active };
}
