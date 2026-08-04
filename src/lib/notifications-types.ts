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

/**
 * The evening-before shopping nudge.
 *
 * Carries its own text and destination, like a meal reminder: there's no cook
 * session or step to describe, and the list it refers to is computed when the
 * reminder is scheduled.
 */
export type ShoppingReminderPayloadV1 = {
  v: 1;
  type: "shopping_reminder";
  planId: string;
  /** The day being shopped for, 'YYYY-MM-DD'. */
  date: string;
  title: string;
  body: string;
  url: string;
  fireAt: string;
  idempotencyKey: string;
};

export type AnyPushPayload =
  | PushPayloadV1
  | MealReminderPayloadV1
  | ShoppingReminderPayloadV1;

/** Narrows a stored jsonb payload. Anything without this type is a cook payload. */
export function isMealReminderPayload(p: AnyPushPayload): p is MealReminderPayloadV1 {
  return p.type === "meal_reminder";
}

export function isShoppingReminderPayload(p: AnyPushPayload): p is ShoppingReminderPayloadV1 {
  return p.type === "shopping_reminder";
}

/** The cook-timer payload, which the email and SMS renderers are written against. */
export function isCookTimerPayload(p: AnyPushPayload): p is PushPayloadV1 {
  return p.type === "cook_timer";
}

/** True for payloads whose text lives on the payload rather than in the cook renderers. */
export function isSelfDescribingPayload(p: AnyPushPayload): boolean {
  return isMealReminderPayload(p) || isShoppingReminderPayload(p);
}
