"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocalNotifications } from "@capacitor/local-notifications";
import { advanceCookStepAction, extendStepTimerAction } from "@/actions/cook";
import { isNative } from "@/lib/native";
import { COOK_TIMER_ACTION_TYPE, EXTEND_SECONDS } from "@/lib/native/notification-actions";
import { syncNotifications } from "@/lib/native/notifications";

/**
 * Buttons on the lock screen, and what happens when they're pressed.
 *
 * This is the clearest answer to the question App Review asks under guideline
 * 4.2 — what does this do that a website cannot? A website cannot put "+5 min"
 * on a lock screen. More to the point, it is what the kitchen actually needs:
 * the timer goes, the pasta wants another two minutes, and the useful response
 * is to say so without drying your hands, unlocking the phone, finding the app
 * and hunting for the right step.
 *
 * Renders nothing, mounted once in the layout. On the web it does nothing at
 * all.
 *
 * **A press can arrive from a cold start.** If the app was closed, iOS and
 * Android launch it and deliver the event once a listener exists — so this is
 * mounted at the layout level rather than on the cook screen, which may never
 * render. The payload carries everything needed (`extra`), so the handler does
 * not depend on any screen having loaded first.
 */
export function NativeNotificationActions() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;

    const setup = async () => {
      // Registered before any notification is scheduled; iOS attaches the
      // buttons by category id at schedule time and silently shows none if the
      // type was never registered.
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: COOK_TIMER_ACTION_TYPE,
            actions: [
              { id: "extend", title: `+${EXTEND_SECONDS / 60} min` },
              { id: "next", title: "Next step" },
            ],
          },
        ],
      });

      const listener = await LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (event) => {
          if (cancelled) return;
          const extra = (event.notification.extra ?? {}) as {
            url?: string;
            cookSessionId?: string;
            stepIndex?: number;
          };

          void (async () => {
            const { cookSessionId, stepIndex } = extra;
            const canAct = typeof cookSessionId === "string" && typeof stepIndex === "number";

            if (event.actionId === "extend" && canAct) {
              const res = await extendStepTimerAction({
                cookSessionId,
                stepIndex,
                extraSeconds: EXTEND_SECONDS,
              });
              if ("ok" in res) {
                // Move the on-device alarm to match, so the extension holds
                // even if the app is closed again immediately.
                await syncNotifications(
                  [
                    {
                      key: `${cookSessionId}:step:${stepIndex}`,
                      title: event.notification.title ?? "Timer",
                      body: event.notification.body ?? "",
                      fireAt: new Date(res.fireAt).getTime(),
                      kind: "cook_timer",
                      url: `/cook/${cookSessionId}`,
                    },
                  ],
                  "cook",
                );
              }
              // Deliberately no navigation: the point of this button is to not
              // have to look at the phone.
              return;
            }

            if (event.actionId === "next" && canAct) {
              await advanceCookStepAction({ cookSessionId, stepIndex: stepIndex + 1 });
            }

            // Any other press — including tapping the notification body — opens
            // where it points. `tap` is the id both platforms use for that.
            if (extra.url) router.push(extra.url);
          })();
        },
      );

      return listener;
    };

    const pending = setup();
    return () => {
      cancelled = true;
      void pending.then((l) => l?.remove());
    };
  }, [router]);

  return null;
}
