import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { getPublicLogoUrl } from "@/lib/public-logo-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const logo = getPublicLogoUrl();
  return {
    title: "Focolare — recipes on your schedule",
    description: "Guided cook mode, reverse scheduling, and creator channels.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: logo, type: "image/png" }],
      apple: [{ url: logo, type: "image/png" }],
    },
    appleWebApp: { capable: true, title: "Focolare", statusBarStyle: "black-translucent" },
  };
}

export const viewport = {
  themeColor: "#0f0f0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-neutral-950 text-neutral-100"
        suppressHydrationWarning
      >
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
