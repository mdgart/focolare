import Image from "next/image";
import Link from "next/link";
import { getPublicLogoUrl } from "@/lib/public-logo-url";
import { getServerSession } from "@/lib/session";

export async function Header() {
  const session = await getServerSession();
  const logoSrc = getPublicLogoUrl();
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-4">
        <Link
          href="/"
          aria-label="Focolare home"
          className="flex items-center gap-3 shrink-0"
        >
          <div className="relative">
            <Image
              src={logoSrc}
              alt=""
              width={40}
              height={40}
              priority
              unoptimized
              className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_16px_rgba(249,115,22,0.35)]"
            />
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-lg font-bold tracking-tight text-amber-100">Focolare</span>
            <span className="text-xs text-neutral-500">Cook with Confidence</span>
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-8 text-sm">
          <Link
            href="/discover"
            className="text-neutral-400 transition hover:text-amber-100 font-medium"
          >
            Discover
          </Link>
          <Link
            href="/create/recipe"
            className="text-neutral-400 transition hover:text-amber-100 font-medium"
          >
            Create
          </Link>
          <Link
            href="/taxonomy/suggest"
            className="text-neutral-400 transition hover:text-amber-100 font-medium"
          >
            Suggest
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                {session.user.email?.[0].toUpperCase()}
              </div>
              <span className="hidden text-sm text-neutral-400 sm:block truncate max-w-[150px]">{session.user.email}</span>
            </div>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-neutral-400 transition hover:text-amber-100 font-medium sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white hover:from-orange-600 hover:to-amber-600 transition shadow-lg shadow-orange-500/20"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
