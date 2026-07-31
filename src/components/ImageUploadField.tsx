"use client";

import { useState } from "react";
import Image from "next/image";
import { formField } from "@/lib/form-styles";

export type UploadedImage = { mediaId: string; publicUrl: string };

type Props = {
  label: string;
  value: UploadedImage | null;
  onChange: (next: UploadedImage | null) => void;
  optional?: boolean;
  previewShape?: "video" | "circle";
};

export function ImageUploadField({ label, value, onChange, optional, previewShape = "video" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; media?: { id: string; publicUrl: string } };
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      if (!data.media?.id) {
        setError("Invalid response");
        return;
      }
      onChange({ mediaId: data.media.id, publicUrl: data.media.publicUrl });
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {optional && value ? (
          <button
            type="button"
            className="text-xs font-semibold text-terracotta underline decoration-terracotta/40 hover:text-terracotta-strong"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        ) : null}
      </div>
      {value ? (
        previewShape === "circle" ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-full ring-1 ring-sand-strong">
            <Image src={value.publicUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="relative aspect-video max-h-48 w-full max-w-md overflow-hidden rounded-xl ring-1 ring-sand-strong">
            <Image src={value.publicUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        )
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={busy}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        className={`${formField} cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-terracotta-tint file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-terracotta-strong hover:file:bg-[#f0d9c4]`}
      />
      {busy ? <p className="text-xs text-ink-muted">Uploading…</p> : null}
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
