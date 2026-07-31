"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { followChannelAction, unfollowChannelAction } from "@/actions/channels";

export function FollowChannelButton(props: {
  channelId: string;
  initialFollowing: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(props.initialFollowing);
  const [pending, setPending] = useState(false);

  if (props.isOwner) return null;

  async function toggle() {
    setPending(true);
    const res = following
      ? await unfollowChannelAction(props.channelId)
      : await followChannelAction(props.channelId);
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    setFollowing((f) => !f);
    router.refresh();
  }

  return following ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className="rounded-full border border-sand-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-terracotta hover:text-terracotta-strong disabled:opacity-50"
    >
      {pending ? "…" : "Following"}
    </button>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-[#fff8f0] transition hover:bg-terracotta-strong disabled:opacity-50"
    >
      {pending ? "…" : "Follow"}
    </button>
  );
}

export function FollowChannelButtonGuest(props: { signInHref: string }) {
  return (
    <Link
      href={props.signInHref}
      className="inline-flex rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-[#fff8f0] transition hover:bg-terracotta-strong"
    >
      Follow
    </Link>
  );
}
