"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A ticking wall clock, read the way React wants external sources read.
 *
 * Calling `Date.now()` during render is impure — the value changes between
 * renders on its own, so the compiler can't treat the component as idempotent.
 * Subscribing instead makes the clock an explicit external store: render stays
 * pure, and a tick is what causes the re-render.
 *
 * Returns `0` on the server and during hydration, so callers should treat 0 as
 * "not known yet" rather than "the epoch". That also removes the hydration
 * mismatch you get from rendering server time into client markup.
 */
type ClockStore = {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
};

/** One shared timer per interval, however many components subscribe. */
const stores = new Map<number, ClockStore>();

function storeFor(intervalMs: number): ClockStore {
  let store = stores.get(intervalMs);
  if (!store) {
    store = { now: 0, listeners: new Set(), timer: null };
    stores.set(intervalMs, store);
  }
  return store;
}

export function useNowMs(intervalMs = 30_000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const store = storeFor(intervalMs);
      store.listeners.add(onChange);

      if (store.timer === null) {
        // Seed immediately so the first post-subscribe read is a real time,
        // then tick for as long as anyone is listening.
        store.now = Date.now();
        store.timer = setInterval(() => {
          store.now = Date.now();
          for (const listener of store.listeners) listener();
        }, intervalMs);
      }

      return () => {
        store.listeners.delete(onChange);
        if (store.listeners.size === 0 && store.timer !== null) {
          clearInterval(store.timer);
          store.timer = null;
        }
      };
    },
    [intervalMs],
  );

  const getSnapshot = useCallback(() => storeFor(intervalMs).now, [intervalMs]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
