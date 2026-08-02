import Link from "next/link";
import { redirect } from "next/navigation";
import { listPantryStaples } from "@/actions/pantry";
import { getServerSession } from "@/lib/session";
import { PantryClient } from "./pantry-client";

export const metadata = { title: "Pantry staples · Focolare" };

export default async function PantryPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in?next=/pantry");

  const staples = await listPantryStaples();

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-8">
      <div className="pt-2 sm:pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Your kitchen
        </p>
        <h1 className="text-3xl sm:text-4xl">Pantry staples</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Things you always have in. Shopping lists set these aside so you only buy what you
          actually need — nothing is ever hidden, just moved out of the way.
        </p>
      </div>

      <PantryClient staples={staples} />

      <p className="text-sm text-ink-muted">
        <Link href="/plan" className="font-medium text-terracotta hover:text-terracotta-strong">
          ← Back to meal plans
        </Link>
      </p>
    </div>
  );
}
