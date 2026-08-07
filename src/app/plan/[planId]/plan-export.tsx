"use client";

import { useEffect, useState, useTransition } from "react";
import { planAsText } from "@/actions/meal-plans";
import { Share } from "@capacitor/share";
import { useIsNative } from "@/lib/native";

/** "Weekend baking" -> "weekend-baking". Falls back so a file is always named. */
function fileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "meal-plan";
}

/**
 * Getting the plan off the screen: copy, download, share, print.
 *
 * Print is the page printing itself through its own stylesheet rather than a
 * separate print route, so the paper version can't drift from the screen one.
 * The rest hand over plain text, which pastes into a message or a note intact.
 */
export function PlanExport({ planId, planTitle }: { planId: string; planTitle: string }) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const native = useIsNative();

  useEffect(() => {
    // Rendered only after mount, so the server and first client render agree —
    // and set asynchronously, since a synchronous setState in an effect body
    // cascades renders (react-hooks/set-state-in-effect).
    let cancelled = false;
    void Promise.resolve().then(() => {
      // The native shell always can, via the OS sheet — `navigator.share` is
      // unavailable in WKWebView, so the web check alone would hide it there.
      if (cancelled) return;
      if (native || (typeof navigator !== "undefined" && typeof navigator.share === "function")) {
        setCanShare(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [native]);

  function withText(what: (text: string) => Promise<void> | void, failure: string) {
    setNote(null);
    startTransition(async () => {
      const text = await planAsText(planId);
      if (!text) {
        setNote("Couldn't read that plan.");
        return;
      }
      try {
        await what(text);
      } catch (err) {
        // A cancelled share or a refused clipboard both land here; neither is
        // worth an alarming message.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNote(failure);
      }
    });
  }

  function copy() {
    withText(async (text) => {
      await navigator.clipboard.writeText(text);
      setNote("Copied.");
    }, "Couldn't copy — your browser blocked it.");
  }

  function download() {
    withText((text) => {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileSlug(planTitle)}.txt`;
      // In the DOM and revoked a tick later: Firefox ignores clicks on detached
      // links, and revoking in the same tick can cancel the download outright.
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setNote("Downloaded.");
    }, "Couldn't download that.");
  }

  function share() {
    withText(async (text) => {
      // One sheet, two implementations: the OS share sheet in the shell, the
      // Web Share API in a browser.
      if (native) {
        await Share.share({ title: planTitle, text, dialogTitle: "Share this plan" });
      } else {
        await navigator.share({ title: planTitle, text });
      }
    }, "Couldn't share that.");
  }

  const buttonClass =
    "rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {/* Inert in a WebView — window.print() opens nothing — so it isn't offered. */}
      {native ? null : (
        <button type="button" onClick={() => window.print()} className={buttonClass}>
          Print
        </button>
      )}
      <button type="button" onClick={copy} disabled={isPending} className={buttonClass}>
        Copy
      </button>
      <button type="button" onClick={download} disabled={isPending} className={buttonClass}>
        Download
      </button>
      {canShare ? (
        <button type="button" onClick={share} disabled={isPending} className={buttonClass}>
          Share…
        </button>
      ) : null}
      {note ? <span className="text-xs text-ink-muted">{note}</span> : null}
    </div>
  );
}
