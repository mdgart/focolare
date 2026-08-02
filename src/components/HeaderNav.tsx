"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type HeaderNavIcon = "discover" | "planner" | "create" | "admin";

export type HeaderNavItem = {
  href: string;
  label: string;
  icon: HeaderNavIcon;
  /** Terracotta rather than ink, for the admin link. */
  accent?: boolean;
};

/**
 * The main navigation, in the two shapes the header needs.
 *
 * A client component only because it marks the section you're in — the links
 * themselves are static, but plain text with no current-page indication left
 * them anonymous, and an icon plus a filled pill gives each one a silhouette
 * you can aim at without reading.
 */
export function HeaderNav({
  items,
  variant,
}: {
  items: HeaderNavItem[];
  variant: "bar" | "chips";
}) {
  const pathname = usePathname();

  // "/plan" should light up for "/plan/abc" too, without "/create" matching
  // "/created-something".
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "chips") {
    return (
      <nav
        className="flex gap-2 overflow-x-auto border-t border-sand/70 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Main"
      >
        {items.map((item) => {
          const current = isCurrent(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                current
                  ? "border-terracotta bg-terracotta-tint text-terracotta-strong"
                  : "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
              }`}
            >
              <NavIcon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main">
      {items.map((item) => {
        const current = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.95rem] font-medium transition ${
              current
                ? "bg-terracotta-tint text-terracotta-strong"
                : item.accent
                  ? "text-terracotta hover:bg-sunken hover:text-terracotta-strong"
                  : "text-ink-soft hover:bg-sunken hover:text-terracotta-strong"
            }`}
          >
            <NavIcon
              name={item.icon}
              className={`h-[18px] w-[18px] transition ${
                current ? "text-terracotta-strong" : "text-ink-muted group-hover:text-terracotta"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Line icons at 20×20, matching the weight used elsewhere in the app. */
function NavIcon({ name, className }: { name: HeaderNavIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      {name === "discover" ? (
        <>
          <circle cx="10" cy="10" r="7.25" />
          <path d="M13 7l-1.7 4.3L7 13l1.7-4.3L13 7z" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "planner" ? (
        <>
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
          <path d="M3 8.5h14M7 3v3M13 3v3" strokeLinecap="round" />
          <path d="M6.5 12h2M11.5 12h2" strokeLinecap="round" />
        </>
      ) : null}
      {name === "create" ? (
        <>
          <circle cx="10" cy="10" r="7.25" />
          <path d="M10 6.75v6.5M6.75 10h6.5" strokeLinecap="round" />
        </>
      ) : null}
      {name === "admin" ? (
        <path
          d="M10 2.75l5.5 2.25v4.5c0 3.2-2.2 6.05-5.5 7-3.3-.95-5.5-3.8-5.5-7V5l5.5-2.25z"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
