import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getChannelProfileForUser } from "@/actions/channels";
import { listRecipesForUser } from "@/actions/recipes";
import { db } from "@/db";
import { user } from "@/db/schema";
import { cookNotifyChannelsAvailable } from "@/lib/cook-timer-notify";
import { getOrCreateChannelForUser } from "@/lib/ensure-channel";
import { PLAN_LIMITS, type Plan } from "@/lib/entitlements";
import { getServerSession } from "@/lib/session";
import { MyRecipesList } from "./my-recipes-list";
import { ProfileAvatarForm } from "./profile-avatar-form";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { NotificationSettingsForm } from "./notification-settings-form";
import { RestoreIntroButton } from "./restore-intro-button";

export const metadata = {
  title: "Account · Focolare",
};

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");

  await getOrCreateChannelForUser({
    userId: session.user.id,
    displayName: session.user.name ?? "Creator",
  });

  const [profile, myRecipes, myChannel] = await Promise.all([
    db.select().from(user).where(eq(user.id, session.user.id)).limit(1).then((rows) => rows[0]),
    listRecipesForUser(session.user.id),
    getChannelProfileForUser(session.user.id),
  ]);

  const email = profile?.email ?? session.user.email ?? "";
  const displayName = profile?.name ?? session.user.name ?? "—";
  const verified = profile?.emailVerified ?? session.user.emailVerified ?? false;
  const createdAt = profile?.createdAt;
  const channels = cookNotifyChannelsAvailable();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Account</h1>
        <p className="mt-1 text-sm text-neutral-600">Your profile and sign-in details.</p>
        {myChannel ? (
          <Link
            href={`/c/${myChannel.slug}`}
            className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-950"
          >
            View your public profile →
          </Link>
        ) : null}
      </div>

      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        <div className="grid gap-1 px-4 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-neutral-500">Name</dt>
          <dd className="text-sm text-neutral-900 sm:col-span-2">{displayName}</dd>
        </div>
        <div className="grid gap-1 px-4 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-neutral-500">Email</dt>
          <dd className="text-sm text-neutral-900 sm:col-span-2">
            {email}
            {verified ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                Verified
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                Unverified
              </span>
            )}
          </dd>
        </div>
        {createdAt ? (
          <div className="grid gap-1 px-4 py-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500">Member since</dt>
            <dd className="text-sm text-neutral-900 sm:col-span-2">
              {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(createdAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      {myChannel ? (
        <ProfileAvatarForm
          channelTitle={myChannel.title}
          initialAvatar={
            myChannel.avatarMediaId && myChannel.avatarPublicUrl
              ? { mediaId: myChannel.avatarMediaId, publicUrl: myChannel.avatarPublicUrl }
              : null
          }
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Your recipes</h2>
            <p className="text-sm text-neutral-600">Edit or remove recipes you&apos;ve published.</p>
          </div>
          <Link
            href="/create/recipe"
            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          >
            New recipe
          </Link>
        </div>
        <MyRecipesList recipes={myRecipes} />
      </section>

      <section className="space-y-3 rounded-2xl border border-sand bg-surface p-5">
        <div>
          <h2 className="text-lg">Home page welcome</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The intro panel on the home page — the one explaining what Focolare does.
          </p>
        </div>
        <RestoreIntroButton hidden={profile?.hideHomeIntro ?? false} />
      </section>

      <section className="space-y-3 rounded-2xl border border-sand bg-surface p-5">
        <div>
          <h2 className="text-lg">On this device</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Push has to be enabled per device and per browser, because the subscription belongs to
            the browser rather than to your account.
          </p>
        </div>
        <PushNotificationToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY?.trim() || null} />
      </section>

      <NotificationSettingsForm
        key={`${profile?.phoneE164 ?? ""}-${profile?.notifyCookTimerEmail}-${profile?.notifyCookTimerSms}`}
        initialPhone={profile?.phoneE164 ?? null}
        initialNotifyEmail={profile?.notifyCookTimerEmail ?? false}
        initialNotifySms={profile?.notifyCookTimerSms ?? false}
        smtpConfigured={channels.smtp}
        twilioConfigured={channels.twilio}
        smsEntitled={PLAN_LIMITS[(profile?.plan as Plan) ?? "free"].smsNotifications}
      />

      <p className="text-sm text-neutral-600">
        Use the menu under your name in the header to <strong>log out</strong>, or go back to{" "}
        <Link href="/discover" className="font-medium text-amber-800 underline hover:text-amber-950">
          Discover
        </Link>
        .
      </p>
    </div>
  );
}
