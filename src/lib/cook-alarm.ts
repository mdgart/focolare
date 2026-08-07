import { isNative } from "@/lib/native";
import { nativeBuzz } from "@/lib/native/haptics";

/**
 * The noise a finished timer makes, in the page that's showing it.
 *
 * Separate from the push notification on purpose. The push is for when the cook
 * has walked away — it goes through a scheduled server event and needs the
 * dispatcher running, notification permission, and a working subscription. None
 * of that helps the far more common case: the phone is propped on the counter
 * with the cook screen open, and the timer reaches zero. That should just make a
 * sound, and it shouldn't depend on anything but the tab being alive.
 *
 * Synthesised rather than an audio file so there's nothing to load, nothing to
 * 404, and no wait between zero and the beep.
 */

export type Alarm = {
  /**
   * Must be called from a user gesture — browsers won't let a page make noise
   * otherwise, and a timer reaching zero is not a gesture. Starting a timer is,
   * which is exactly when this gets called.
   */
  prime: () => void;
  ring: () => void;
};

const BEEP_HZ = 880;
const BEEP_SECONDS = 0.18;
/** Three short beeps reads as "done" rather than as a notification blip. */
const BEEP_COUNT = 3;
const BEEP_GAP_SECONDS = 0.22;

export function createAlarm(): Alarm {
  let ctx: AudioContext | null = null;

  function audio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  }

  return {
    prime() {
      const context = audio();
      // Created inside a gesture, so it starts "running"; resume() covers the
      // case where it was suspended after a previous backgrounding.
      void context?.resume().catch(() => {});
    },

    ring() {
      const context = audio();
      if (context) {
        void context.resume().catch(() => {});
        const start = context.currentTime;
        for (let i = 0; i < BEEP_COUNT; i++) {
          const at = start + i * BEEP_GAP_SECONDS;
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = "sine";
          osc.frequency.value = BEEP_HZ;
          // Ramped rather than switched, because an abrupt gain change clicks.
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + BEEP_SECONDS);
          osc.connect(gain).connect(context.destination);
          osc.start(at);
          osc.stop(at + BEEP_SECONDS + 0.02);
        }
      }

      /**
       * Phones in kitchens are often face-down or muted.
       *
       * `navigator.vibrate` is a **no-op in WKWebView** — it exists, it returns,
       * and nothing happens — so on iOS the alarm had no physical signal at all
       * unless the phone was audible. In the native shell the Haptics plugin
       * does the real thing; on the web the old path is unchanged.
       *
       * Fired without awaiting: this runs at zero o'clock alongside the beep,
       * and a plugin round-trip should not delay the sound.
       */
      if (isNative()) {
        void nativeBuzz();
      } else {
        try {
          navigator.vibrate?.([200, 120, 200, 120, 400]);
        } catch {
          /* not supported, or blocked without interaction */
        }
      }
    },
  };
}
