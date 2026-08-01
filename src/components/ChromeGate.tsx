"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the site header and footer inside cook mode.
 *
 * Cooking is a focused, hands-busy activity often done on a propped-up phone.
 * Site navigation there is noise at best and a mis-tap away from losing your
 * place at worst, so the cook screen carries its own single way back.
 *
 * The chrome is still rendered on the server and passed in as children; this
 * only decides whether to show it, which keeps Header a server component.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/cook/")) return null;
  return <>{children}</>;
}

/** Cook mode wants the full viewport, not the centred article column. */
export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/cook/");

  return (
    <main
      className={
        bare
          ? "flex w-full min-w-0 flex-1 flex-col"
          : "mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:bg-white print:px-6 print:py-6 print:text-neutral-900"
      }
    >
      {children}
    </main>
  );
}
