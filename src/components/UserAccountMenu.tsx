"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

import { CreatorAvatar } from "@/components/CreatorAvatar";

type Props = {
  email: string;
  name: string | null | undefined;
  /** The user's own channel page — where their recipes live. */
  profileHref?: string;
  avatarUrl?: string | null;
  /** Cooks and long ferments currently underway. */
  inProgressCount?: number;
};

export function UserAccountMenu({ email, name, profileHref, avatarUrl, inProgressCount = 0 }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  async function onSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    setSigningOut(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const initial = email[0]?.toUpperCase() ?? "?";
  const displayLine = name?.trim() || email;
  const avatarTitle = name?.trim() || email;

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        type="button"
        id="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[220px] items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition hover:bg-sunken"
      >
        <span className="relative shrink-0">
          {avatarUrl ? (
            <CreatorAvatar title={avatarTitle} imageUrl={avatarUrl} size="xs" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-xs font-bold text-[#fff8f0]">
              {initial}
            </span>
          )}
          {inProgressCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-background"
            />
          ) : null}
        </span>
        <span className="hidden min-w-0 flex-col sm:flex">
          <span className="truncate text-sm font-medium text-ink">{displayLine}</span>
          {name?.trim() ? <span className="truncate text-xs text-ink-muted">{email}</span> : null}
        </span>
      </button>

      {open ? (
        <div
          id="user-menu"
          role="menu"
          aria-labelledby="user-menu-button"
          className="absolute right-0 top-full z-50 mt-2 min-w-[15rem] overflow-hidden rounded-2xl border border-sand bg-surface py-1.5 shadow-lg"
        >
          {profileHref ? (
            <MenuLink href={profileHref} onClick={close}>
              <span>My recipes</span>
              <span className="text-xs text-ink-muted">Your channel</span>
            </MenuLink>
          ) : null}

          <MenuLink href="/saved" onClick={close}>
            <span>Saved</span>
            <span className="text-xs text-ink-muted">Recipes to cook later</span>
          </MenuLink>

          <MenuLink href="/plan" onClick={close}>
            <span>Meal plans</span>
            <span className="text-xs text-ink-muted">Plan a week, get a shopping list</span>
          </MenuLink>

          <MenuLink href="/preparations" onClick={close}>
            <span className="flex items-center gap-2">
              In progress
              {inProgressCount > 0 ? (
                <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-[#fff8f0]">
                  {inProgressCount}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-ink-muted">Cooks &amp; ferments underway</span>
          </MenuLink>

          <MenuLink href="/create/recipe" onClick={close}>
            <span>New recipe</span>
          </MenuLink>

          <div className="my-1.5 border-t border-sand" />

          <MenuLink href="/pantry" onClick={close}>
            <span>Pantry staples</span>
          </MenuLink>

          <MenuLink href="/account" onClick={close}>
            <span>Account settings</span>
          </MenuLink>

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void onSignOut()}
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-terracotta transition hover:bg-terracotta-tint/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex flex-col gap-0.5 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sunken"
    >
      {children}
    </Link>
  );
}
