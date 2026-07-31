import Link from "next/link";
import { CreatorAvatar } from "@/components/CreatorAvatar";
import { FollowChannelButton, FollowChannelButtonGuest } from "@/components/FollowChannelButton";

export function CreatorProfileBar(props: {
  channelId: string;
  channelSlug: string;
  channelTitle: string;
  avatarUrl?: string | null;
  followerCount: number;
  following: boolean;
  isOwner: boolean;
  isLoggedIn: boolean;
  signInHref?: string;
  compact?: boolean;
}) {
  const followersLabel =
    props.followerCount === 1 ? "1 follower" : `${props.followerCount.toLocaleString()} followers`;

  return (
    <div className={`flex flex-wrap items-center gap-4 ${props.compact ? "" : "mt-2"}`}>
      <Link
        href={`/c/${props.channelSlug}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-90"
      >
        <CreatorAvatar
          title={props.channelTitle}
          imageUrl={props.avatarUrl}
          size={props.compact ? "md" : "lg"}
        />
        <span className="min-w-0">
          <span className={`block truncate font-semibold text-neutral-900 ${props.compact ? "text-sm" : "text-base"}`}>
            {props.channelTitle}
          </span>
          <span className="block text-xs text-neutral-500">{followersLabel}</span>
        </span>
      </Link>
      {props.isOwner ? null : props.isLoggedIn ? (
        <FollowChannelButton
          channelId={props.channelId}
          initialFollowing={props.following}
          isOwner={props.isOwner}
        />
      ) : (
        <FollowChannelButtonGuest signInHref={props.signInHref ?? "/sign-in"} />
      )}
    </div>
  );
}

/** Avatar + name link for recipe cards (separate from recipe link). */
export function CreatorLink(props: {
  channelSlug: string;
  channelTitle: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={`/c/${props.channelSlug}`}
      className={`flex items-center gap-2 transition hover:text-amber-900 ${props.className ?? ""}`}
    >
      <CreatorAvatar title={props.channelTitle} imageUrl={props.avatarUrl} size="sm" />
      <span className="truncate text-sm text-neutral-600">{props.channelTitle}</span>
    </Link>
  );
}
