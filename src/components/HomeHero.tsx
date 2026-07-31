"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dismissHomeIntroAction } from "@/actions/account";

const GUEST_STORAGE_KEY = "focolare.dismissHomeIntro";

export function HomeHero({
  preparationCount,
  initialHidden,
  isLoggedIn,
}: {
  preparationCount: number;
  initialHidden: boolean;
  isLoggedIn: boolean;
}) {
  const [visible, setVisible] = useState(() => (isLoggedIn ? !initialHidden : true));

  useEffect(() => {
    if (isLoggedIn) return;
    try {
      setVisible(localStorage.getItem(GUEST_STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, [isLoggedIn]);

  async function dismiss() {
    setVisible(false);
    if (isLoggedIn) {
      const res = await dismissHomeIntroAction();
      if ("error" in res) setVisible(true);
      return;
    }
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <section className="relative">
      <button
        type="button"
        aria-label="Dismiss welcome message"
        onClick={() => void dismiss()}
        className="absolute -right-1 -top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-sunken hover:text-ink sm:right-0 sm:top-0"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="grid items-center gap-10 py-6 sm:py-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14 lg:py-14">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            A warm table for makers
          </p>
          <h1 className="text-4xl leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
            Good food,{" "}
            <em className="font-display italic text-terracotta-strong">perfectly timed</em>.
          </h1>
          <p className="mt-4 text-sm text-ink-muted">
            <span className="font-semibold text-ink-soft">Focolare</span>{" "}
            <span className="whitespace-nowrap">(fo-co-LA-re)</span> — Italian for the kitchen
            hearth, the fire a home gathers around.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Tell Focolare when you want dinner on the table. It plans backwards, walks you through
            every step, and rings you when it&apos;s time to start.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/discover" className="btn btn-primary text-center">
              Explore recipes
            </Link>
            {preparationCount > 0 ? (
              <Link href="/preparations" className="btn btn-secondary text-center">
                In progress ({preparationCount})
              </Link>
            ) : (
              <Link href="/create/recipe" className="btn btn-secondary text-center">
                Share your first recipe
              </Link>
            )}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            <HeroFeature label="Guided cook mode">
              <path d="M10 5.5V10l3 2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="7.25" />
            </HeroFeature>
            <HeroFeature label="Reverse scheduling">
              <path d="M4 10a6 6 0 1 1 1.76 4.24" strokeLinecap="round" />
              <path d="M4 10H1.5M4 10l1.8 2.2" strokeLinecap="round" strokeLinejoin="round" />
            </HeroFeature>
            <HeroFeature label="Creator channels">
              <circle cx="7" cy="8" r="2.75" />
              <path d="M2.5 16a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
              <path d="M13 8.25a2.5 2.5 0 1 0 .01-4.99M14.5 11.5a4.5 4.5 0 0 1 3 4.5" strokeLinecap="round" />
            </HeroFeature>
          </ul>
        </div>

        <div className="relative hidden h-[430px] lg:block" aria-hidden="true">
          <div className="absolute right-0 top-0 h-full w-[78%] overflow-hidden rounded-[2rem]">
            <Image
              src="/bread.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 0px, 40vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -left-1 bottom-6 w-[44%] overflow-hidden rounded-3xl border-4 border-surface shadow-xl">
            <div className="relative aspect-square">
              <Image
                src="/dessert.jpg"
                alt=""
                fill
                sizes="(max-width: 1024px) 0px, 20vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="absolute left-8 top-8 flex items-center gap-3 rounded-2xl border border-sand bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-strong">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                <circle cx="10" cy="10" r="7.25" />
                <path d="M10 5.5V10l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xs leading-tight">
              <span className="block font-semibold text-ink">Ready at 7:30 PM</span>
              <span className="block text-ink-muted">Start the dough by 1:15 PM</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroFeature({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-[18px] w-[18px] text-terracotta"
        aria-hidden="true"
      >
        {children}
      </svg>
      {label}
    </li>
  );
}
