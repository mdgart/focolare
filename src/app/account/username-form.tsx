"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateChannelUsernameAction } from "@/actions/channels";
import { formField } from "@/lib/form-styles";
import { USERNAME_MAX_LENGTH, normalizeUsername } from "@/lib/username";

export function UsernameForm(props: { username: string; host: string }) {
  const router = useRouter();
  const [value, setValue] = useState(props.username);
  const [saved, setSaved] = useState(props.username);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The preview shows the address they'd actually get, punctuation folded and
  // all, so a name that changes on save doesn't come as a surprise.
  const preview = normalizeUsername(value) || "…";
  const changed = value.trim() !== saved;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateChannelUsernameAction(value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(res.username);
      setValue(res.username);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sand bg-surface p-5">
      <div>
        <h2 className="text-lg">Your address</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The link you share. Changing it retires the old one — anywhere you&apos;ve posted it will
          stop working.
        </p>
      </div>

      <label className="block text-sm font-medium text-ink" htmlFor="username">
        Username
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">{props.host}/c/</span>
        <input
          id="username"
          name="username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          maxLength={USERNAME_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${formField} max-w-xs`}
        />
      </div>

      <p className="text-sm text-ink-muted">
        Your profile will live at{" "}
        <span className="font-medium text-ink">
          {props.host}/c/{preview}
        </span>
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !changed}
          className="btn btn-secondary !py-2 text-sm disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save username"}
        </button>
        {!changed && !error ? <span className="text-sm text-ink-muted">Saved</span> : null}
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
