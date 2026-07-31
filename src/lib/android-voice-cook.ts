/** Chrome on Android exposes webkitSpeechRecognition; keep behind a toggle. */

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

type SpeechRecCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

export function getAndroidSpeechRecognitionCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined" || !isAndroidDevice()) return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function androidSpeechRecognitionAvailable(): boolean {
  return getAndroidSpeechRecognitionCtor() != null;
}

/** Final transcript → start the step countdown (when a duration exists). */
export function transcriptMeansStartTimer(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return false;
  return /\bstart(\s+the\s+)?timer\b/.test(t) || /\bbegin(\s+the\s+)?timer\b/.test(t) || /^\s*go\s*!?\s*$/.test(t);
}

/** Final transcript → advance to next step (not last). */
export function transcriptMeansNextStep(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return false;
  return (
    /\bnext\s+step\b/.test(t) ||
    /\bnext\b/.test(t) ||
    /\bcontinue\b/.test(t) ||
    /\bskip\b/.test(t) ||
    /\bforward\b/.test(t)
  );
}

/** Final transcript → finish session (last step only). */
export function transcriptMeansFinish(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return false;
  return /\b(finish|done|complete|end(\s+session)?)\b/.test(t);
}
