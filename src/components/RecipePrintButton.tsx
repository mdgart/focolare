"use client";

import { useIsNative } from "@/lib/native";

/**
 * Hidden inside the native shell.
 *
 * `window.print()` opens nothing in a WKWebView or an Android WebView — the
 * button is simply inert, which reads as a broken app rather than a missing
 * feature. There is a native print path, but a recipe card is not what people
 * reach for a printer to do from a phone, so the honest move is to not offer it.
 * Removing dead chrome is also part of the argument that this is an app rather
 * than a wrapped website.
 */
export function RecipePrintButton() {
  if (useIsNative()) return null;

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sand-strong bg-surface px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong print:hidden"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          d="M5.5 7.5V3h9v4.5M5.5 14.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5h12A1.5 1.5 0 0 1 17.5 9v4a1.5 1.5 0 0 1-1.5 1.5h-1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="5.5" y="12" width="9" height="5" rx="0.5" />
      </svg>
      Print recipe
    </button>
  );
}
