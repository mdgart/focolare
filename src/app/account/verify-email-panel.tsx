"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailPanel({
  email,
  verified,
  enforced,
}: {
  email: string;
  verified: boolean;
  /** Whether publishing actually requires verification on this deployment. */
  enforced: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setSending(true);
    setError(null);
    const { error: err } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/account",
    });
    setSending(false);
    if (err) {
      setError(err.message ?? "Couldn't send the email — try again shortly.");
      return;
    }
    setSent(true);
  }

  if (verified) {
    return (
      <section className="space-y-2 rounded-2xl border border-sage/40 bg-[#eef2ea] p-5">
        <h2 className="text-lg">Email confirmed</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">{email}</strong> is verified, so you can publish recipes and
          recover your account if you forget your password.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-terracotta/40 bg-terracotta-tint/40 p-5">
      <div>
        <h2 className="text-lg">Confirm your email</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          We sent a link to <strong className="text-ink">{email}</strong>.{" "}
          {enforced
            ? "Confirming it lets you publish recipes — you can keep writing drafts until then."
            : "Confirming it means we can help you back in if you forget your password."}
        </p>
      </div>

      {sent ? (
        <p className="text-sm font-medium text-sage">
          Sent. Check your inbox, and your spam folder if it isn&apos;t there.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={sending}
          className="btn btn-primary !px-5 !py-2 text-sm disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend the link"}
        </button>
      )}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
