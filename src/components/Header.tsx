import Image from "next/image";
import Link from "next/link";
import { getPublicLogoUrl } from "@/lib/public-logo-url";
import { getServerSession } from "@/lib/session";

export async function Header() {
  const session = await getServerSession();
  const logoSrc = getPublicLogoUrl();
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          aria-label="Focolare home"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-amber-100"
        >
          <Image
            src={logoSrc}
            alt=""
            width={40}
            height={40}
            priority
            unoptimized
            className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_12px_rgba(251,146,60,0.25)]"
          />
          <span aria-hidden="true">Focolare</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm text-neutral-300">
          <Link href="/discover" className="hover:text-white">
            Discover
          </Link>
          <Link href="/create/recipe" className="hover:text-white">
            New recipe
          </Link>
          <Link href="/taxonomy/suggest" className="hover:text-white">
            Suggest category
          </Link>
          {session?.user ? (
            <span className="text-neutral-400">{session.user.email}</span>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-white">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-amber-500/90 px-3 py-1 font-medium text-neutral-950 hover:bg-amber-400"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
