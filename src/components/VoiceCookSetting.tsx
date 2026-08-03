"use client";

import { androidSpeechRecognitionAvailable } from "@/lib/android-voice-cook";
import { setLocalStorageValue, useLocalStorageValue } from "@/lib/use-local-storage-value";

export const VOICE_COOK_STORAGE_KEY = "focolare.voiceCookEnabled";

/** True once the cook has opted in on this device. */
export function voiceCookEnabled(stored: string | null | undefined): boolean {
  return stored === "1";
}

/**
 * Opting in to voice control for cook mode.
 *
 * Kept on the device rather than the account, because that's what it describes:
 * whether *this* browser has a microphone and speech recognition. The same
 * account on a laptop shouldn't inherit a phone's answer.
 *
 * It lives here rather than in cook mode because it's a setting, and a panel
 * explaining an optional feature was taking up the top of a screen someone is
 * trying to cook from.
 */
export function VoiceCookSetting() {
  const stored = useLocalStorageValue(VOICE_COOK_STORAGE_KEY);
  const on = voiceCookEnabled(stored);
  const supported = androidSpeechRecognitionAvailable();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Voice control while cooking</p>
        <p className="mt-1 text-sm text-ink-soft">
          {supported
            ? "Say “next”, “start timer” or “finish” instead of touching the screen. Cook mode shows a microphone button when this is on."
            : "Not available in this browser — it needs Chrome on Android."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Turn off voice control" : "Turn on voice control"}
        disabled={!supported}
        onClick={() => setLocalStorageValue(VOICE_COOK_STORAGE_KEY, on ? "0" : "1")}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          on ? "bg-terracotta" : "bg-sand-strong"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
