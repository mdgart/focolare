import Image from "next/image";
import Link from "next/link";
import { getPublicLogoUrl } from "@/lib/public-logo-url";
import { getServerSession } from "@/lib/session";

export async function Header() {
  const session = await getServerSession();
  const logoSrc = getPublicLogoUrl();
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-300 bg-white/95 backdrop-blur-sm shadow-sm">
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
              width={56}
              height={56}
              priority
              unoptimized
              className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(139,115,85,0.2)]"
            />
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-2xl font-bold tracking-tight text-amber-900">Focolare</span>
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-8 text-sm">
          <Link
            href="/discover"
            className="text-neutral-600 transition hover:text-amber-900 font-medium"
          >
            Discover
          </Link>
          <Link
            href="/create/recipe"
            className="text-neutral-600 transition hover:text-amber-900 font-medium"
          >
            Create
          </Link>
          <Link
            href="/taxonomy/suggest"
            className="text-neutral-600 transition hover:text-amber-900 font-medium"
          >
            Suggest
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center text-xs font-bold text-white">
                {session.user.email?.[0].toUpperCase()}
              </div>
              <span className="hidden text-sm text-neutral-600 sm:block truncate max-w-[150px]">{session.user.email}</span>
            </div>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-neutral-600 transition hover:text-amber-900 font-medium sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="btn btn-primary text-sm"
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
