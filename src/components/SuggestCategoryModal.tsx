"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { suggestCategoryWithPlaceholderAction } from "@/actions/taxonomy";
import { formField } from "@/lib/form-styles";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  parentCategoryOptions: { id: string; label: string }[];
  onCreated: (row: { id: string; label: string }) => void;
};

export function SuggestCategoryModal(props: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (props.open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [props.open]);

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/40"
      onCancel={(ev) => {
        ev.preventDefault();
        props.onClose();
      }}
    >
      {/* Mounted only while open, so the fields reset on each open without an effect. */}
      {props.open ? <SuggestCategoryForm {...props} /> : null}
    </dialog>
  );
}

function SuggestCategoryForm(props: ModalProps) {
  const [label, setLabel] = useState("");
  const [parentId, setParentId] = useState("");
  const [synonyms, setSynonyms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await suggestCategoryWithPlaceholderAction({
      proposedLabel: label,
      parentCategoryId: parentId || null,
      synonyms: synonyms || null,
    });
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    props.onCreated({ id: res.categoryId, label: res.label });
    props.onClose();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Suggest a category</h2>
            <p className="mt-1 text-sm text-neutral-600">
              We&apos;ll save your idea for review. You can file this recipe under it right away; it appears in
              Discover after an admin approves it.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <div>
          <label htmlFor="suggest-cat-label" className="text-sm font-medium text-neutral-800">
            New category name
          </label>
          <input
            id="suggest-cat-label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Fermentation"
            className={`mt-1 ${formField}`}
          />
        </div>
        <div>
          <label htmlFor="suggest-cat-parent" className="text-sm font-medium text-neutral-800">
            Parent (optional — makes this a subcategory)
          </label>
          <select
            id="suggest-cat-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={`mt-1 ${formField}`}
          >
            <option value="">— Top level —</option>
            {props.parentCategoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="suggest-cat-synonyms" className="text-sm font-medium text-neutral-800">
            Synonyms (optional)
          </label>
          <input
            id="suggest-cat-synonyms"
            value={synonyms}
            onChange={(e) => setSynonyms(e.target.value)}
            placeholder="e.g. levain, sourdough starter"
            className={`mt-1 ${formField}`}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={props.onClose} className="btn border border-neutral-300 bg-white font-medium">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn btn-primary font-semibold">
            {pending ? "Saving…" : "Save and use category"}
          </button>
        </div>
    </form>
  );
}
