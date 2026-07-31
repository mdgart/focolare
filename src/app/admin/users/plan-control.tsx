"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUserPlanAction } from "@/actions/admin-users";

/** Comp an account to Pro, or drop it back to Free. No payment involved. */
export function PlanControl({ userId, plan }: { userId: string; plan: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPro = plan === "pro";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setUserPlanAction(userId, isPro ? "free" : "pro");
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        title={isPro ? "Return this account to the free plan" : "Give this account Pro, without a payment"}
        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
          isPro
            ? "border-sand-strong bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta-strong"
            : "border-terracotta/50 bg-terracotta-tint text-terracotta-strong hover:bg-[#f0d9c4]"
        }`}
      >
        {isPending ? "Saving…" : isPro ? "Make Free" : "Grant Pro"}
      </button>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
