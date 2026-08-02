/**
 * Focolare service worker — cook-timer notifications.
 *
 * Runs with no page open, which is the entire point: a bulk ferment finishing at
 * 3am has to reach someone whose browser is closed. The server encrypts a payload
 * against this device's subscription keys and hands it to the browser's push
 * service, which wakes this worker and delivers it to the `push` handler below.
 *
 * Served from /sw.js so its scope covers the whole app.
 */

/** Matches PushPayloadV1 in src/lib/notifications-types.ts. */
function readPayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { title: "Focolare", body: event.data.text() };
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  if (!payload) return;

  // Meal reminders carry their own copy and destination — there is no cook
  // session or step to describe.
  if (payload.type === "meal_reminder") {
    event.waitUntil(
      self.registration.showNotification(payload.title || "Time to start cooking", {
        body: payload.body || "",
        icon: "/logo.png",
        badge: "/logo.png",
        tag: payload.idempotencyKey || payload.mealSlotId || "focolare-meal",
        renotify: true,
        requireInteraction: true,
        data: { url: payload.url || "/plan" },
      }),
    );
    return;
  }

  const stepNumber = typeof payload.stepIndex === "number" ? payload.stepIndex + 1 : null;
  const title = payload.recipeTitle ? `${payload.recipeTitle} — timer` : "Focolare";
  const body = payload.stepTitle
    ? stepNumber
      ? `Step ${stepNumber}: ${payload.stepTitle} is ready.`
      : `${payload.stepTitle} is ready.`
    : (payload.body ?? "A cook timer finished.");

  // The push service only guarantees delivery if a notification is shown, so this
  // must run even when the payload is unexpected.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      // Collapses repeats for the same step instead of stacking duplicates.
      tag: payload.idempotencyKey || payload.cookSessionId || "focolare-timer",
      renotify: true,
      requireInteraction: true,
      data: {
        url: payload.url ?? (payload.cookSessionId ? `/cook/${payload.cookSessionId}` : "/preparations"),
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/preparations";

  // Focus an existing tab when one is open rather than piling up new ones.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/** Take over immediately on install rather than waiting for every tab to close. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
