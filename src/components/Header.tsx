import Image from "next/image";
import Link from "next/link";
import { getChannelProfileForUser } from "@/actions/channels";
import { countOngoingPreparationsForUser } from "@/actions/preparations";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { getPublicLogoMarkUrl } from "@/lib/public-logo-url";
import { getServerSession } from "@/lib/session";
import { HeaderNav, type HeaderNavItem } from "@/components/HeaderNav";
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

  const navItems: HeaderNavItem[] = [
    { href: "/discover", label: "Discover", icon: "discover" },
    ...(session?.user
      ? [{ href: "/plan", label: "Planner", icon: "planner" as const }]
      : []),
    { href: "/create/recipe", label: "Create", icon: "create" },
    ...(showAdmin
      ? [{ href: "/admin/taxonomy", label: "Admin", icon: "admin" as const, accent: true }]
      : []),
  ];

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

          <HeaderNav items={navItems} variant="bar" />

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

        <HeaderNav items={navItems} variant="chips" />
      </div>
    </header>
  );
}

