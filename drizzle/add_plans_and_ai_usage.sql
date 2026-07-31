-- Billing tier + AI usage metering.
DO $$ BEGIN
  CREATE TYPE "user_plan" AS ENUM ('free', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "plan" "user_plan" NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS "ai_usage_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_usage_user_created_idx" ON "ai_usage_event" ("user_id", "created_at");
