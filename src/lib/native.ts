"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Am I running inside the native shell, and on what?
 *
 * The whole `server.url` approach rests on one assumption: that Capacitor
 * injects its bridge into a **remote** page, not just into files bundled in the
 * binary. If it doesn't, `getPlatform()` says `web` inside the app, every
 * native capability is unreachable, and the plan needs rethinking before
 * anything else is built. That is the Phase 0 gate, and this is what it reads.
 *
 * `window.Capacitor` is injected by the native runtime before the page script
 * runs, so this works even though the JavaScript was served from the internet.
 */

export type NativePlatform = "ios" | "android" | "web";

export function getPlatform(): NativePlatform {
  // Guarded for SSR: this module is imported by client components that Next
  // still renders on the server, where `window` doesn't exist.
  if (typeof window === "undefined") return "web";
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

/**
 * True only inside the native shell.
 *
 * Used to hide web-only chrome — the print buttons do nothing useful in a
 * WebView — and, from Phase 1, to decide whether to schedule an OS-level
 * notification instead of relying on the server cron.
 */
export function isNative(): boolean {
  return getPlatform() !== "web";
}

/**
 * The platform, safely readable from a component.
 *
 * `useSyncExternalStore` rather than an effect, because this is precisely what
 * it is for: a value that differs between server and client and must not be
 * guessed during SSR. Reading it in an effect and calling `setState` trips
 * React 19's cascading-render rule; reading it during render would hydrate
 * "web" and then flip, which is the mismatch this avoids.
 *
 * The platform can't change while the app runs, so `subscribe` never fires.
 */
export function useNativePlatform(): NativePlatform {
  return useSyncExternalStore(
    () => () => {},
    getPlatform,
    // Server render: always the web shell, whatever the device turns out to be.
    () => "web" as const,
  );
}

/** The Phase 2 lever for hiding web-only chrome, e.g. the print buttons. */
export function useIsNative(): boolean {
  return useNativePlatform() !== "web";
}
