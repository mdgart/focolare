"use client";

import Image from "next/image";
import { useState } from "react";
import type { UploadedImage } from "@/components/ImageUploadField";
import type { StockPhoto } from "@/lib/stock-photos";
import { formField } from "@/lib/form-styles";

/**
 * Search free stock photos and adopt one as the cover.
 *
 * The chosen photo is copied into our own storage rather than hot-linked, so a
 * recipe keeps its picture even if the original disappears upstream.
 */
export function StockPhotoPicker({
  defaultQuery,
  onPicked,
}: {
  /** Seeded from the recipe title so the first search is usually the right one. */
  defaultQuery: string;
  onPicked: (image: UploadedImage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const [photos, setPhotos] = useState<StockPhoto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(term: string) {
    const q = term.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { photos?: StockPhoto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
        setPhotos([]);
        return;
      }
      setPhotos(data.photos ?? []);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(photo: StockPhoto) {
    setImportingId(photo.id);
    setError(null);
    try {
      const res = await fetch("/api/photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      const data = (await res.json()) as {
        media?: { id: string; publicUrl: string };
        error?: string;
      };
      if (!res.ok || !data.media?.id) {
        setError(data.error ?? "Couldn't use that photo.");
        return;
      }
      onPicked({ mediaId: data.media.id, publicUrl: data.media.publicUrl });
      setOpen(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setImportingId(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!photos && defaultQuery.trim()) void search(defaultQuery);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
          <rect x="2.5" y="4" width="15" height="12" rx="2" />
          <circle cx="7" cy="8.5" r="1.3" />
          <path d="M3 13.5l4-3.5 3.5 3 3-2.5 3.5 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Find a free photo
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sand bg-[#fffdf8] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Free photos</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search(query);
            }
          }}
          placeholder="e.g. sourdough bread"
          className={`${formField} flex-1`}
        />
        <button
          type="button"
          onClick={() => void search(query)}
          disabled={searching || !query.trim()}
          className="btn btn-primary shrink-0 !px-5 !py-2 text-sm disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {photos && photos.length === 0 && !searching ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Nothing found for that. Try a simpler word — the dish name usually works best.
        </p>
      ) : null}

      {photos && photos.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void pick(p)}
                  disabled={importingId !== null}
                  className="group relative block w-full overflow-hidden rounded-xl ring-1 ring-sand-strong transition hover:ring-2 hover:ring-terracotta disabled:opacity-60"
                >
                  <span className="relative block aspect-[4/3] bg-sunken">
                    <Image
                      src={p.thumbUrl}
                      alt={p.alt}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, 200px"
                      className="object-cover"
                    />
                  </span>
                  {importingId === p.id ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-xs font-semibold text-[#fff8f0]">
                      Adding…
                    </span>
                  ) : null}
                  <span className="block truncate px-2 py-1 text-left text-[0.65rem] text-ink-muted">
                    {p.credit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            Free to use via Pexels. The photographer is credited on your recipe.
          </p>
        </>
      ) : null}
    </div>
  );
}
