"use client";

export function RecipePrintButton() {
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
