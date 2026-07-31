"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { formField } from "@/lib/form-styles";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: name || email.split("@")[0] || "cook",
    });
    setPending(false);
    if (error) {
      window.alert(error.message ?? "Sign up failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-xl font-semibold">Sign up</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          placeholder="Display name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={formField}
        />
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
          autoComplete="new-password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={formField}
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-amber-900 underline hover:text-amber-950">
          Sign in
        </Link>
      </p>
    </div>
  );
}
