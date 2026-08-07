"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/actions/delete-account";

/**
 * Leaving.
 *
 * Deliberately plain rather than alarming. Someone who has decided to go should
 * be able to do it without being nagged, guilt-tripped, or made to hunt — dark
 * patterns around leaving are the reason app stores now require this to exist.
 * It sits behind one disclosure so it can't be hit by accident, and then it
 * says exactly what will happen.
 *
 * The published-recipes sentence matters most. Someone deleting an account
 * reasonably assumes everything goes, and finding their recipes still up
 * afterwards would feel like a broken promise — so it is stated before the
 * button, not discovered after.
 */
export function DeleteAccountPanel({ email, publishedCount }: { email: string; publishedCount: number }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccountAction({ confirmEmail });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Full reload rather than a router push: the session is gone, and every
      // cached server component still holds this person's data.
      window.location.href = "/?left=1";
    });
  }

  if (!open) {
    return (
      <section className="border-t border-sand pt-6">
        <h2 className="text-sm font-semibold text-ink">Delete your account</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Removes your account and everything personal to it.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-full border border-sand-strong px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-red-400 hover:text-red-700"
        >
          Delete my account…
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <h2 className="text-sm font-semibold text-ink">Delete your account</h2>

      <div className="mt-2 max-w-prose space-y-2 text-sm text-ink-soft">
        <p>
          This is immediate and cannot be undone. Your account, email, photo, meal plans, pantry,
          shopping lists, cook history, saved recipes and follows are all deleted.
        </p>
        {publishedCount > 0 ? (
          <p>
            <strong className="font-semibold text-ink">
              Your {publishedCount === 1 ? "published recipe stays" : `${publishedCount} published recipes stay`}{" "}
              online, under an anonymous name.
            </strong>{" "}
            Other people have saved {publishedCount === 1 ? "it" : "them"} and may have{" "}
            {publishedCount === 1 ? "it" : "them"} in a meal plan — removing{" "}
            {publishedCount === 1 ? "it" : "them"} would take something away from them. Your name,
            profile and address are removed from {publishedCount === 1 ? "it" : "them"} entirely. If
            you would rather they came down, delete them first, then come back here.
          </p>
        ) : null}
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-ink">Type {email} to confirm</span>
        <input
          type="email"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="mt-1 block w-full max-w-sm rounded-lg border border-sand-strong bg-surface px-3 py-2 text-sm text-ink"
          placeholder={email}
        />
      </label>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || confirmEmail.trim().length === 0}
          className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Delete my account permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmEmail("");
            setError(null);
          }}
          disabled={isPending}
          className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          Keep my account
        </button>
      </div>
    </section>
  );
}
