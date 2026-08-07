"use client";

import { useEffect } from "react";
import { App as CapApp } from "@capacitor/app";
import { pendingRemindersAction } from "@/actions/native-reminders";
import { isNative } from "@/lib/native";
import { syncNotifications } from "@/lib/native/notifications";

/**
 * Keeps meal and shopping reminders on the phone, so they arrive without the
 * server having to reach it.
 *
 * Renders nothing. Mounted once in the layout because reminders belong to the
 * whole app rather than any screen — the planner schedules them days ahead, and
 * whichever page someone happens to be on is irrelevant to whether tomorrow's
 * "start cooking at six" is on the device.
 *
 * **On the web this does nothing at all**, and that is deliberate: browsers keep
 * the existing web-push path, which is unchanged. This is strictly the native
 * addition.
 *
 * Re-pulls on resume rather than polling. Every path that changes a plan already
 * reschedules the server rows, so by the time someone has switched away and back
 * the server is right and the phone simply needs to catch up. The reconciler
 * leaves matching alarms untouched, so the common case — nothing changed — does
 * no platform work beyond one read.
 */
export function NativeReminderSync() {
  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const desired = await pendingRemindersAction();
        if (cancelled) return;
        await syncNotifications(desired, "reminders");
      } catch {
        // Offline, or signed out. Either way the alarms already on the device
        // stay exactly as they are — which is the point of scheduling them
        // locally. Failing loudly here would mean an error toast on a cook
        // screen because a background refresh couldn't reach the server.
      }
    };

    void sync();
    const listener = CapApp.addListener("resume", () => void sync());

    return () => {
      cancelled = true;
      void listener.then((l) => l.remove());
    };
  }, []);

  return null;
}
