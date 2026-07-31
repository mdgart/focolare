"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { formField } from "@/lib/form-styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "Something went wrong — try again.");
      return;
    }
    // Always the same outcome, so this can't be used to discover which emails exist.
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6 sm:pt-12">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Account
        </p>
        <h1 className="text-3xl">Forgot your password?</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Enter the email you signed up with and we&apos;ll send a link to choose a new password.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-sage/40 bg-[#eef2ea] px-5 py-4">
          <p className="text-sm font-semibold text-ink">Check your inbox</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            If an account exists for <strong className="text-ink">{email.trim()}</strong>, a reset
            link is on its way. It expires in an hour.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Didn&apos;t arrive? Check spam, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-terracotta underline hover:text-terracotta-strong"
            >
              try another address
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1.5 ${formField}`}
            />
          </label>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-50">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-terracotta hover:text-terracotta-strong">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
