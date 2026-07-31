"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { blockUserAction, unblockUserAction } from "@/actions/admin-users";
import { formFieldDense } from "@/lib/form-styles";

export function BlockControls({
  userId,
  blocked,
  isAdmin,
  isSelf,
}: {
  userId: string;
  blocked: boolean;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return <span className="text-xs text-ink-muted">That&apos;s you</span>;
  if (isAdmin && !blocked) return <span className="text-xs text-ink-muted">Admin</span>;

  function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      setReason("");
      router.refresh();
    });
  }

  if (blocked) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => unblockUserAction(userId))}
          className="rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-sage hover:text-sage disabled:opacity-60"
        >
          {isPending ? "Working…" : "Unblock"}
        </button>
        {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-200 bg-surface px-3.5 py-1.5 text-sm font-medium text-red-800 transition hover:border-red-400 hover:bg-red-50"
        >
          Block
        </button>
        {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional, admin-only)"
        className={`${formFieldDense} w-56`}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => blockUserAction(userId, reason))}
          className="rounded-full bg-red-700 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
        >
          {isPending ? "Blocking…" : "Confirm block"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded-full border border-sand-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
