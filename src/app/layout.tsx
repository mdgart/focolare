import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ChromeGate, MainShell } from "@/components/ChromeGate";
import { Header } from "@/components/Header";
import { getPublicLogoSvgUrl, getPublicLogoUrl } from "@/lib/public-logo-url";
import "./globals.css";
import { NativeReminderSync } from "@/components/NativeReminderSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const logoPng = getPublicLogoUrl();
  const logoSvg = getPublicLogoSvgUrl();
  return {
    title: "Focolare — recipes on your schedule",
    description: "Guided cook mode, reverse scheduling, and creator channels.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: logoSvg, type: "image/svg+xml" },
        { url: logoPng, type: "image/png" },
      ],
      apple: [{ url: logoPng, type: "image/png" }],
    },
    appleWebApp: { capable: true, title: "Focolare", statusBarStyle: "black-translucent" },
  };
}

export const viewport = {
  themeColor: "#faf5ec",
  /**
   * Required for `env(safe-area-inset-*)` to mean anything.
   *
   * In the native shell the WebView fills the screen, notch and home indicator
   * included — so without this the header runs under the clock and the Dynamic
   * Island, which is exactly what it did on an iPhone. The trap is that the
   * insets only become readable *because* of this setting: with the default
   * `auto`, `env(safe-area-inset-top)` is zero, so there is nothing to
   * compensate with and no obvious sign of why.
   *
   * Harmless in a browser, where the insets are zero anyway.
   */
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col overflow-x-hidden bg-background text-ink antialiased"
        suppressHydrationWarning
      >
        <ChromeGate>
          <Header />
        </ChromeGate>
        <MainShell>{children}</MainShell>
        <ChromeGate>
        <footer className="mt-16 border-t border-sand bg-surface print:hidden">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
            <div className="max-w-sm">
              <p className="font-display text-xl font-semibold text-ink">Focolare</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                A warm table for makers — recipes with guided cook mode and schedules that work
                backwards from dinner time.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm" aria-label="Footer">
              <Link href="/discover" className="text-ink-soft transition hover:text-terracotta-strong">
                Discover
              </Link>
              <Link href="/create/recipe" className="text-ink-soft transition hover:text-terracotta-strong">
                Create a recipe
              </Link>
              <Link href="/tags" className="text-ink-soft transition hover:text-terracotta-strong">
                Tags
              </Link>
              <Link
                href="/taxonomy/suggest"
                className="text-ink-soft transition hover:text-terracotta-strong"
              >
                Suggest a category
              </Link>
            </nav>
          </div>
          <div className="border-t border-sand/70">
            <p className="mx-auto w-full max-w-[1400px] px-4 py-4 text-xs text-ink-muted sm:px-6 lg:px-8">
              © {new Date().getFullYear()} Focolare. Made for slow food and good timing.
            </p>
          </div>
        </footer>
        </ChromeGate>
        {/* Renders nothing; keeps the phone's own reminder alarms in step. */}
        <NativeReminderSync />
      </body>
    </html>
  );
}
