"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Read a localStorage key reactively.
 *
 * Reading it in an effect and calling setState causes a cascading render, which
 * the React compiler rejects. localStorage is an external store, so subscribe to
 * it instead: render stays pure and a write is what triggers the update.
 *
 * Returns `undefined` while the value isn't known yet (server render and
 * hydration), which callers can distinguish from `null` — "read it, nothing
 * there" — so a persisted "dismissed" flag doesn't flash its content first.
 */
const listeners = new Set<() => void>();

function notifyLocalStorageChanged(): void {
  for (const listener of listeners) listener();
}

function subscribeToStorage(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` only fires for *other* tabs; same-tab writes go through
  // setLocalStorageValue below, which notifies directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLocalStorageValue(key: string): string | null | undefined {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  return useSyncExternalStore(subscribeToStorage, getSnapshot, () => undefined);
}

/** Write a value and tell every subscriber in this tab about it. */
export function setLocalStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — the UI still updates via the notify below */
  }
  notifyLocalStorageChanged();
}
