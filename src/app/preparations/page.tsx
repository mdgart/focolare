import Link from "next/link";
import { redirect } from "next/navigation";
import { listOngoingPreparationsForUser } from "@/actions/preparations";
import { getServerSession } from "@/lib/session";
import { PreparationCard } from "./preparation-card";

export const metadata = {
  title: "In progress · Focolare",
};

export default async function PreparationsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in?next=/preparations");

  const items = await listOngoingPreparationsForUser();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Your kitchen
        </p>
        <h1 className="text-3xl sm:text-4xl">In progress</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Recipes you&apos;ve started and haven&apos;t finished — cooks underway plus ferments, cures,
          preserves, and long proofs. Come back when a step is ready, or mark one done.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sand-strong bg-surface/60 px-6 py-16 text-center">
          <p className="text-ink-soft">Nothing on the go right now.</p>
          <Link href="/discover" className="btn btn-primary mt-6 inline-flex">
            Find a recipe to cook
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.cookSessionId}>
              <PreparationCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
