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
