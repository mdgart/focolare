"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { formField } from "@/lib/form-styles";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (err) {
      setError(err.message ?? "That email and password didn't match.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6 sm:pt-12">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Welcome back
        </p>
        <h1 className="text-3xl">Sign in</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={formField}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={formField}
        />
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-right text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-terracotta hover:text-terracotta-strong"
          >
            Forgot your password?
          </Link>
        </p>
      </form>
      <p className="text-sm text-ink-muted">
        No account?{" "}
        <Link href="/sign-up" className="font-medium text-terracotta hover:text-terracotta-strong">
          Sign up
        </Link>
      </p>
    </div>
  );
}
