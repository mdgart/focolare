"use client";

import { useEffect, useState } from "react";

/**
 * On-device translation using Chrome's built-in Translator API — no server call,
 * no API cost, and the text never leaves the machine.
 *
 * The API is Chrome-only and fairly new, so this renders nothing at all when it
 * isn't available: the recipe simply stays in its original language.
 *
 * Rather than lifting the whole recipe into client state, this walks the elements
 * the page marked with `data-translate` and swaps their text in place, keeping
 * the originals so the toggle can restore them.
 */

type TranslatorApi = {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<{ translate(text: string): Promise<string> }>;
};

function getTranslator(): TranslatorApi | null {
  const t = (globalThis as { Translator?: TranslatorApi }).Translator;
  return t && typeof t.availability === "function" ? t : null;
}

/** "en-GB" → "en"; the Translator API wants the base language. */
function baseLanguage(tag: string): string {
  return tag.split("-")[0]!.toLowerCase();
}

/**
 * Some Chromium builds expose `Translator` but never settle `availability()`.
 * Without a deadline the button would sit invisible in its checking state forever.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

type State = "idle" | "checking" | "ready" | "downloading" | "translating" | "translated" | "error";

export function TranslateRecipeButton({
  sourceLanguage,
  sourceLabel,
}: {
  sourceLanguage: string;
  sourceLabel: string;
}) {
  // Defaults describe the unsupported case, so the effect never has to set state
  // synchronously to express it — it only reports back once the async check lands.
  const [state, setState] = useState<State>("idle");
  const [supported, setSupported] = useState(false);
  const [target, setTarget] = useState("en");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const api = getTranslator();
    const to = baseLanguage(navigator.language || "en");
    const from = baseLanguage(sourceLanguage);

    // No API, or the recipe is already in the reader's language — nothing to offer.
    if (!api || from === to) return;

    withTimeout(api.availability({ sourceLanguage: from, targetLanguage: to }), 3000)
      .then((availability) => {
        if (cancelled) return;
        // "unavailable" means the pair isn't offered; "timeout" means the build
        // advertises the API but doesn't answer — treat both as unsupported.
        if (availability === "unavailable" || availability === "timeout") return;
        setTarget(to);
        setSupported(true);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setSupported(false);
        setState("idle");
      });

    return () => {
      cancelled = true;
    };
  }, [sourceLanguage]);

  async function translate() {
    const api = getTranslator();
    if (!api) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-translate]"));
    if (nodes.length === 0) return;

    setState("translating");
    setProgress(0);
    try {
      const translator = await api.create({
        sourceLanguage: baseLanguage(sourceLanguage),
        targetLanguage: target,
        monitor: (m) => {
          m.addEventListener("downloadprogress", (e) => {
            const { loaded } = e as ProgressEvent;
            setState("downloading");
            setProgress(Math.round(loaded * 100));
          });
        },
      });
      setState("translating");

      for (const node of nodes) {
        const original = node.dataset.original ?? node.textContent ?? "";
        if (!node.dataset.original) node.dataset.original = original;
        if (!original.trim()) continue;
        node.textContent = await translator.translate(original);
      }
      setState("translated");
    } catch {
      setState("error");
    }
  }

  function restore() {
    for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-translate]"))) {
      if (node.dataset.original != null) node.textContent = node.dataset.original;
    }
    setState("ready");
  }

  if (!supported || state === "checking") return null;

  const busy = state === "translating" || state === "downloading";
  const label =
    state === "downloading"
      ? `Preparing… ${progress}%`
      : state === "translating"
        ? "Translating…"
        : state === "translated"
          ? `Show original (${sourceLabel})`
          : state === "error"
            ? "Translation failed — retry"
            : `Translate to ${target.toUpperCase()}`;

  return (
    <div className="print:hidden">
      <button
        type="button"
        disabled={busy}
        onClick={() => (state === "translated" ? restore() : void translate())}
        className="inline-flex items-center gap-1.5 rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-60"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M2.5 5h7M6 3.5v1.5M7.5 5c0 3-2 5.5-5 6.5M4 7.5c0 2 1.75 3.5 4 4.5" strokeLinecap="round" />
          <path d="M10 17l3.5-8 3.5 8M11.4 14.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {state === "translated" ? (
        <p className="mt-1.5 text-xs text-ink-muted">
          Machine translation, done on your device — measurements and technique may lose nuance.
        </p>
      ) : null}
    </div>
  );
}
