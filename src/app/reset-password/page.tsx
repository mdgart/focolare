"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { formField } from "@/lib/form-styles";

const MIN_LENGTH = 8;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Better Auth appends the token, and sends `error=INVALID_TOKEN` when a link is stale.
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — request a new one.");
      return;
    }

    setPending(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (err) {
      setError(err.message ?? "That link is no longer valid — request a new one.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/sign-in"), 1800);
  }

  if (linkError || !token) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-terracotta/40 bg-terracotta-tint/50 px-5 py-4">
          <p className="text-sm font-semibold text-terracotta-strong">This link has expired</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Reset links last an hour and work once. Request a fresh one and it&apos;ll arrive in a
            moment.
          </p>
        </div>
        <Link href="/forgot-password" className="btn btn-primary w-full">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-sage/40 bg-[#eef2ea] px-5 py-4">
        <p className="text-sm font-semibold text-ink">Password changed</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Taking you to sign in…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="password" className="block text-sm font-medium text-ink">
        New password
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder={`At least ${MIN_LENGTH} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mt-1.5 ${formField}`}
        />
      </label>
      <label htmlFor="confirm" className="block text-sm font-medium text-ink">
        Confirm new password
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={`mt-1.5 ${formField}`}
        />
      </label>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-50">
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6 sm:pt-12">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Account
        </p>
        <h1 className="text-3xl">Choose a new password</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="text-sm text-ink-muted">
        <Link href="/sign-in" className="font-medium text-terracotta hover:text-terracotta-strong">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
