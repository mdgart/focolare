"use client";

import { Haptics, ImpactStyle } from "@capacitor/haptics";

/**
 * The physical half of the alarm, on a phone that can actually do it.
 *
 * `navigator.vibrate` is not merely unreliable in WKWebView — it is absent in
 * effect: the call succeeds and nothing moves. For a timer whose whole job is
 * to reach someone whose hands are busy, that is a silent failure of the exact
 * kind this project keeps finding.
 *
 * The pattern mirrors the beep: three knocks with gaps, heavy enough to feel
 * through a countertop, rather than one buzz that reads as a text message.
 */
export async function nativeBuzz(): Promise<void> {
  const GAP_MS = 320;
  try {
    for (let knock = 0; knock < 3; knock++) {
      if (knock > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  } catch {
    // Simulators have no taptic engine, and a phone can disable system
    // haptics entirely. Neither is worth surfacing — the sound still plays.
  }
}
