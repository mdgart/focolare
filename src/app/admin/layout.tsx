import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { countRecipesForReview } from "@/actions/moderation";
import { isAdminSessionUser } from "@/lib/admin-auth";
import { getServerSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  if (!(await isAdminSessionUser(session.user))) notFound();

  const pendingReview = await countRecipesForReview();

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2 sm:pt-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
            Admin
          </p>
          <h1 className="text-3xl sm:text-4xl">Review</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-terracotta hover:text-terracotta-strong">
          ← Home
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-sand pb-4" aria-label="Admin sections">
        <AdminTab href="/admin/taxonomy">Taxonomy</AdminTab>
        <AdminTab href="/admin/moderation" badge={pendingReview}>
          Moderation
        </AdminTab>
      </nav>

      {children}
    </div>
  );
}

function AdminTab({
  href,
  badge,
  children,
}: {
  href: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-[#fff8f0]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
