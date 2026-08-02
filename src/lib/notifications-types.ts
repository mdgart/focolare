/** @see docs/notifications.md */
export type PushPayloadV1 = {
  v: 1;
  type: "cook_timer" | "cook_reminder";
  cookSessionId: string;
  recipeId: string;
  recipeTitle: string;
  stepIndex: number;
  stepTitle: string;
  fireAt: string;
  idempotencyKey: string;
};

/**
 * "Start cooking now to eat on time" for a planned meal.
 *
 * Carries its own title, body and url rather than cook-specific fields: the same
 * service worker renders it, but there is no cook session, no step, and a
 * different destination.
 */
export type MealReminderPayloadV1 = {
  v: 1;
  type: "meal_reminder";
  mealSlotId: string;
  planId: string;
  recipeId: string;
  recipeTitle: string;
  title: string;
  body: string;
  url: string;
  fireAt: string;
  idempotencyKey: string;
};

export type AnyPushPayload = PushPayloadV1 | MealReminderPayloadV1;

/** Narrows a stored jsonb payload. Anything without this type is a cook payload. */
export function isMealReminderPayload(p: AnyPushPayload): p is MealReminderPayloadV1 {
  return p.type === "meal_reminder";
}
