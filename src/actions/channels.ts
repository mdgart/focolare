"use server";

import { and, count, desc, eq, getTableColumns, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { channel, follow, mediaAsset, recipe, user } from "@/db/schema";
import { getOrCreateChannelForUser } from "@/lib/ensure-channel";
import { getServerSession } from "@/lib/session";

const channelAvatarMedia = alias(mediaAsset, "channel_avatar_media");

export async function getChannelProfileForUser(userId: string) {
  const [row] = await db
    .select({
      id: channel.id,
      slug: channel.slug,
      title: channel.title,
      avatarMediaId: channel.avatarMediaId,
      avatarPublicUrl: channelAvatarMedia.publicUrl,
    })
    .from(channel)
    .leftJoin(channelAvatarMedia, eq(channel.avatarMediaId, channelAvatarMedia.id))
    .where(eq(channel.ownerUserId, userId))
    .limit(1);
  return row ?? null;
}

/** @deprecated use getChannelProfileForUser */
export async function getChannelForUser(userId: string) {
  const profile = await getChannelProfileForUser(userId);
  if (!profile) return null;
  return { id: profile.id, slug: profile.slug, title: profile.title };
}

export async function updateChannelAvatarAction(
  avatarMediaId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  if (avatarMediaId) {
    const [media] = await db
      .select({ id: mediaAsset.id })
      .from(mediaAsset)
      .where(and(eq(mediaAsset.id, avatarMediaId), eq(mediaAsset.ownerUserId, session.user.id)))
      .limit(1);
    if (!media) return { error: "Invalid image" };
  }

  const ch = await getOrCreateChannelForUser({
    userId: session.user.id,
    displayName: session.user.name ?? "Creator",
  });

  await db
    .update(channel)
    .set({ avatarMediaId, updatedAt: new Date() })
    .where(eq(channel.id, ch.id));

  return { ok: true as const };
}

export async function getChannelAvatarPublicUrl(avatarMediaId: string | null): Promise<string | null> {
  return getAvatarPublicUrl(avatarMediaId);
}

async function getAvatarPublicUrl(avatarMediaId: string | null): Promise<string | null> {
  if (!avatarMediaId) return null;
  const [row] = await db
    .select({ publicUrl: mediaAsset.publicUrl })
    .from(mediaAsset)
    .where(eq(mediaAsset.id, avatarMediaId))
    .limit(1);
  return row?.publicUrl ?? null;
}

export async function getChannelFollowerCount(channelId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(follow)
    .where(eq(follow.channelId, channelId));
  return row?.value ?? 0;
}

export async function isUserFollowingChannel(userId: string | null, channelId: string): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db
    .select({ followerUserId: follow.followerUserId })
    .from(follow)
    .where(and(eq(follow.followerUserId, userId), eq(follow.channelId, channelId)))
    .limit(1);
  return Boolean(row);
}

export async function followChannelAction(channelId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Sign in to follow creators" };

  const [ch] = await db
    .select({ ownerUserId: channel.ownerUserId })
    .from(channel)
    .where(eq(channel.id, channelId))
    .limit(1);
  if (!ch) return { error: "Not found" };
  if (ch.ownerUserId === session.user.id) return { error: "You can't follow yourself" };

  await db
    .insert(follow)
    .values({ followerUserId: session.user.id, channelId })
    .onConflictDoNothing({ target: [follow.followerUserId, follow.channelId] });

  return { ok: true as const };
}

export async function unfollowChannelAction(channelId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await db
    .delete(follow)
    .where(and(eq(follow.followerUserId, session.user.id), eq(follow.channelId, channelId)));

  return { ok: true as const };
}

export async function getChannelBySlug(slug: string, opts?: { viewerUserId: string | null }) {
  const [ch] = await db.select().from(channel).where(eq(channel.slug, slug)).limit(1);
  if (!ch) return null;
  const viewer = opts?.viewerUserId ?? null;
  const isOwner = viewer !== null && viewer === ch.ownerUserId;

  // A blocked creator's channel reads as missing to everyone but themselves,
  // so a block hides the profile as well as the recipes.
  if (!isOwner) {
    const [owner] = await db
      .select({ blockedAt: user.blockedAt })
      .from(user)
      .where(eq(user.id, ch.ownerUserId))
      .limit(1);
    if (owner?.blockedAt) return null;
  }
  // Visitors see only finished, public, cleared recipes. The owner sees everything they own,
  // including drafts and anything held for review.
  const recipeWhere = isOwner
    ? eq(recipe.channelId, ch.id)
    : and(
        eq(recipe.channelId, ch.id),
        eq(recipe.visibility, "public"),
        isNotNull(recipe.publishedAt),
        eq(recipe.moderationStatus, "approved"),
      );
  const [recipes, followerCount, following, avatarPublicUrl] = await Promise.all([
    db
      .select({
        ...getTableColumns(recipe),
        coverPublicUrl: mediaAsset.publicUrl,
      })
      .from(recipe)
      .leftJoin(mediaAsset, eq(recipe.coverMediaId, mediaAsset.id))
      .where(recipeWhere)
      .orderBy(desc(recipe.createdAt))
      .limit(50),
    getChannelFollowerCount(ch.id),
    isUserFollowingChannel(viewer, ch.id),
    getAvatarPublicUrl(ch.avatarMediaId),
  ]);
  return { channel: ch, recipes, followerCount, following, isOwner, avatarPublicUrl };
}
