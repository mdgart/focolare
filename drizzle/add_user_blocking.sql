-- Admin blocking. A blocked account cannot sign in and its content is hidden
-- from public listings, but nothing is deleted, so the action is reversible.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "blocked_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "blocked_reason" text;

CREATE INDEX IF NOT EXISTS "user_blocked_idx" ON "user" ("blocked_at");
