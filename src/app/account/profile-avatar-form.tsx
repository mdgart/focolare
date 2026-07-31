"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateChannelAvatarAction } from "@/actions/channels";
import { CreatorAvatar } from "@/components/CreatorAvatar";
import { ImageUploadField, type UploadedImage } from "@/components/ImageUploadField";

export function ProfileAvatarForm(props: {
  channelTitle: string;
  initialAvatar: UploadedImage | null;
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<UploadedImage | null>(props.initialAvatar);
  const [pending, setPending] = useState(false);

  async function onAvatarChange(next: UploadedImage | null) {
    setPending(true);
    const res = await updateChannelAvatarAction(next?.mediaId ?? null);
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    setAvatar(next);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-neutral-900">Profile photo</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Shown on your public profile, recipe cards, and recipe pages.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <CreatorAvatar title={props.channelTitle} imageUrl={avatar?.publicUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <ImageUploadField
            label="Upload photo"
            value={avatar}
            onChange={(next) => void onAvatarChange(next)}
            optional
            previewShape="circle"
          />
          {pending ? <p className="mt-2 text-xs text-neutral-500">Saving…</p> : null}
        </div>
      </div>
    </section>
  );
}
