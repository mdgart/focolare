"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
 */
export function useWakeLock(enabled: boolean) {
  // Read once on the client rather than syncing through an effect; whether the
  // browser has the API never changes for the life of the page.
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "wakeLock" in navigator,
    () => false,
  );
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const release = useCallback(async () => {
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
