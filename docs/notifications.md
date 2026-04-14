# Notifications — worker choice & push contract

## Worker choice: **secured HTTP cron**

We use a **`GET /api/cron/dispatch`** route (see [`src/app/api/cron/dispatch/route.ts`](../src/app/api/cron/dispatch/route.ts)) protected by `Authorization: Bearer ${CRON_SECRET}` (or `?secret=` for local testing only).

**Why not Inngest / Trigger.dev for MVP:** zero extra vendors, runs anywhere (Vercel Cron, GitHub Actions, systemd timer). Tables `scheduled_step_event` + `push_subscription` are the queue.

**Upgrade path:** swap the route body for Inngest `step.sendEvent` or Trigger.dev task enqueue without changing `push_payload` shape.

## Web Push prerequisites

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in env.
- Client registers subscription via **`POST /api/push/register`** (authenticated).

## `push_payload` JSON schema (MVP)

Stored in `scheduled_step_event.push_payload` and sent as the push JSON body (`webpush.sendNotification(..., JSON.stringify(payload))`).

```typescript
type PushPayloadV1 = {
  v: 1;
  type: "cook_timer" | "cook_reminder";
  cookSessionId: string;
  recipeId: string;
  recipeTitle: string;
  stepIndex: number;
  stepTitle: string;
  /** ISO-8601 instant this event was scheduled for */
  fireAt: string;
  /** Idempotency key (duplicate sends safe to ignore client-side) */
  idempotencyKey: string;
};
```

## Idempotency

- **DB:** `scheduled_step_event.idempotency_key` UNIQUE prevents double-insert.
- **Dispatch:** before send, row is claimed with `UPDATE ... WHERE status = 'pending' AND fire_at <= now()` returning rows; after successful send set `status = 'sent'`, `processed_at = now()`. Failures set `failed` (or leave `pending` with retry counter in Phase 2).
