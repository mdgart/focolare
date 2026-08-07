"use client";

import { useState } from "react";
import Image from "next/image";
import { formField } from "@/lib/form-styles";
import { useIsNative } from "@/lib/native";
import { pickNativeImage } from "@/lib/native/camera";

export type UploadedImage = { mediaId: string; publicUrl: string };

type Props = {
  label: string;
  value: UploadedImage | null;
  onChange: (next: UploadedImage | null) => void;
  optional?: boolean;
  previewShape?: "video" | "circle";
};

export function ImageUploadField({ label, value, onChange, optional, previewShape = "video" }: Props) {
  const native = useIsNative();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Opens the OS sheet, then hands the result to the same upload path.
   *
   * A cancelled sheet throws rather than returning null, and that is not an
   * error worth showing anyone — deciding against a photo is a normal thing to
   * do. Only a genuine failure gets a message.
   */
  async function handleNativePick() {
    setError(null);
    try {
      const file = await pickNativeImage();
      if (file) await handleFile(file);
    } catch (e) {
      const cancelled = e instanceof Error && /cancel/i.test(e.message);
      if (!cancelled) setError("Couldn't open the camera.");
    }
  }

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
      {native ? (
        /*
         * One tap instead of five. A file input works in a WebView, but it opens
         * a picker — so photographing a loaf you just took out of the oven means
         * Camera, shoot, Photos, find it, attach. The native sheet offers camera
         * and library together.
         */
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleNativePick()}
          className="inline-flex items-center gap-2 rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
            <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h1.6l.9-1.5h7l.9 1.5H16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8Z" strokeLinejoin="round" />
            <circle cx="10" cy="10.5" r="3" />
          </svg>
          {value ? "Replace photo" : "Take or choose a photo"}
        </button>
      ) : (
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          className={`${formField} cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-terracotta-tint file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-terracotta-strong hover:file:bg-[#f0d9c4]`}
        />
      )}
      {busy ? <p className="text-xs text-ink-muted">Uploading…</p> : null}
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
