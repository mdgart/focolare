import Image from "next/image";
import Link from "next/link";
import { getChannelProfileForUser } from "@/actions/channels";
import { countOngoingPreparationsForUser } from "@/actions/preparations";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { getPublicLogoMarkUrl } from "@/lib/public-logo-url";
import { getServerSession } from "@/lib/session";
import { UserAccountMenu } from "@/components/UserAccountMenu";

export async function Header() {
  const session = await getServerSession();
  const logoSrc = getPublicLogoMarkUrl();
  const showAdmin = session?.user ? await isAdminSessionUser(session.user) : false;
  const [myChannel, inProgressCount] = session?.user
    ? await Promise.all([
        getChannelProfileForUser(session.user.id),
        countOngoingPreparationsForUser(),
      ])
    : [null, 0];

  return (
    <header className="sticky top-0 z-50 border-b border-sand bg-[#faf5ecdd] backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 sm:gap-6">
          <Link href="/" aria-label="Focolare home" className="flex shrink-0 items-center gap-2.5">
            <Image
              src={logoSrc}
              alt=""
              width={56}
              height={56}
              priority
              unoptimized
              className="h-11 w-11 shrink-0 object-contain sm:h-14 sm:w-14"
            />
            <span className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
              Focolare
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 text-[0.95rem] lg:flex">
            <Link href="/discover" className="font-medium text-ink-soft transition hover:text-terracotta-strong">
              Discover
            </Link>
            {session?.user ? (
              <Link
                href="/plan"
                className="font-medium text-ink-soft transition hover:text-terracotta-strong"
              >
                Planner
              </Link>
            ) : null}
            <Link
              href="/create/recipe"
              className="font-medium text-ink-soft transition hover:text-terracotta-strong"
            >
              Create
            </Link>
            {showAdmin ? (
              <Link
                href="/admin/taxonomy"
                className="font-medium text-terracotta transition hover:text-terracotta-strong"
              >
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {session?.user?.email ? (
              <UserAccountMenu
                email={session.user.email}
                name={session.user.name}
                profileHref={myChannel ? `/c/${myChannel.slug}` : undefined}
                avatarUrl={myChannel?.avatarPublicUrl ?? null}
                inProgressCount={inProgressCount}
              />
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden font-medium text-ink-soft transition hover:text-terracotta-strong sm:block"
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className="btn btn-primary px-4 py-2 text-sm sm:px-5 sm:py-2.5">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <nav
          className="flex gap-2 overflow-x-auto border-t border-sand/70 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          <HeaderChip href="/discover">Discover</HeaderChip>
          {session?.user ? <HeaderChip href="/plan">Planner</HeaderChip> : null}
          <HeaderChip href="/create/recipe">Create</HeaderChip>
          {showAdmin ? <HeaderChip href="/admin/taxonomy">Admin</HeaderChip> : null}
        </nav>
      </div>
    </header>
  );
}

function HeaderChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
    >
      {children}
    </Link>
  );
}
