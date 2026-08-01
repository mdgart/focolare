import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listGroceryItems } from "@/actions/grocery";
import { getMealPlanForOwner } from "@/actions/meal-plans";
import { getServerSession } from "@/lib/session";
import { GrocerySection } from "./grocery-section";
import { PlannerClient } from "./planner-client";

export const metadata = { title: "Meal plan · Focolare" };

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getServerSession();
  if (!session?.user) redirect(`/sign-in?next=/plan/${planId}`);

  const plan = await getMealPlanForOwner(planId);
  if (!plan) notFound();

  const groceries = await listGroceryItems(planId);

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-10">
      <div className="pt-2 sm:pt-6">
        <Link href="/plan" className="text-sm font-medium text-terracotta hover:text-terracotta-strong">
          ← All plans
        </Link>
      </div>

      <PlannerClient plan={plan} />
      <GrocerySection planId={planId} initialItems={groceries} />
    </div>
  );
}
