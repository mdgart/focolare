import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { listGroceryItems } from "@/actions/grocery";
import { getMealPlanForOwner } from "@/actions/meal-plans";
import { getServerSession } from "@/lib/session";
import { GrocerySection } from "./grocery-section";
import { PlanExport } from "./plan-export";
import { PlanPrintSheet } from "./plan-print-sheet";
import { PlannerClient } from "./planner-client";

export const metadata = { title: "Meal plan · Focolare" };

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getServerSession();
  if (!session?.user) redirect(`/sign-in?next=/plan/${planId}`);

  const plan = await getMealPlanForOwner(planId);
  if (!plan) notFound();

  const groceries = await listGroceryItems(planId);

  // Resolved here, not in the client: reading window during render makes the
  // server and client output differ, which is a hydration mismatch.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="print-sheet mx-auto min-w-0 max-w-5xl space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 sm:pt-6">
        <Link
          href="/plan"
          className="text-sm font-medium text-terracotta hover:text-terracotta-strong print:hidden"
        >
          ← All plans
        </Link>
        <PlanExport planId={planId} planTitle={plan.title} />
      </div>

      {/* The screen version is all controls; paper gets its own render below. */}
      <div className="space-y-10 print:hidden">
        <PlannerClient plan={plan} origin={origin} />
        <GrocerySection planId={planId} initialItems={groceries} />
      </div>

      <PlanPrintSheet plan={plan} groceries={groceries} />
    </div>
  );
}
