import Link from "next/link";
import { listUsersForAdmin } from "@/actions/admin-users";
import { getServerSession } from "@/lib/session";
import { BlockControls } from "./block-controls";

export const metadata = { title: "Users · Focolare admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [users, session] = await Promise.all([listUsersForAdmin({ q }), getServerSession()]);
  const blockedCount = users.filter((u) => u.blockedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl">People</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Blocking signs the account out immediately, stops it signing back in, and hides its
          channel and recipes from everyone else. Nothing is deleted, so it can be undone.
        </p>
      </div>

      <form action="/admin/users" method="get" className="flex max-w-md gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or email…"
          aria-label="Search users"
          className="min-w-0 flex-1 rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-terracotta"
        />
        <button type="submit" className="btn btn-primary !px-5 !py-2 text-sm">
          Search
        </button>
        {q ? (
          <Link
            href="/admin/users"
            className="inline-flex items-center rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft hover:border-terracotta"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-ink-muted">
        {users.length} {users.length === 1 ? "account" : "accounts"}
        {blockedCount > 0 ? ` · ${blockedCount} blocked` : null}
      </p>

      {users.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-14 text-center">
          <p className="text-ink-soft">{q ? "Nobody matches that search." : "No accounts yet."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-surface">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{u.name}</span>
                  {u.isAdmin ? (
                    <span className="rounded-full bg-terracotta-tint px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-terracotta-strong">
                      Admin
                    </span>
                  ) : null}
                  {u.plan === "pro" ? (
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
                      Pro
                    </span>
                  ) : null}
                  {u.blockedAt ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-red-900">
                      Blocked
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">{u.email}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {u.recipeCount} {u.recipeCount === 1 ? "recipe" : "recipes"}
                  {u.channelSlug ? (
                    <>
                      {" · "}
                      <Link href={`/c/${u.channelSlug}`} className="hover:text-terracotta-strong">
                        /c/{u.channelSlug}
                      </Link>
                    </>
                  ) : null}
                  {" · joined "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(u.createdAt)}
                </p>
                {u.blockedAt ? (
                  <p className="mt-1.5 text-xs text-red-800">
                    Blocked {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(u.blockedAt)}
                    {u.blockedReason ? ` — ${u.blockedReason}` : ""}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 sm:self-center">
                <BlockControls
                  userId={u.id}
                  blocked={Boolean(u.blockedAt)}
                  isAdmin={u.isAdmin}
                  isSelf={u.id === session?.user?.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
