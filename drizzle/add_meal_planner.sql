-- Meal planner: plans, slots, pantry staples, on-hand items, grocery lists,
-- "I made it" photos, and the generalisation of scheduled_step_event so a
-- reminder can belong to a meal slot instead of a cook session.
--
-- Every statement is guarded: this file is replayed on every deploy.

DO $$ BEGIN
  CREATE TYPE "meal_type" AS ENUM ('breakfast', 'lunch', 'dinner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "meal_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT 'Meal plan',
  "start_date" date NOT NULL,
  -- Inclusive. The action caps the range at 31 days.
  "end_date" date NOT NULL,
  -- IANA zone captured from the planner's browser. Meal times are wall-clock in
  -- this zone, so reminders stay correct wherever the server runs.
  "timezone" text NOT NULL DEFAULT 'UTC',
  -- Null means private. Set to a nanoid when shared; nulled again to revoke.
  "share_slug" text UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "meal_plan_user_idx" ON "meal_plan" ("user_id");

CREATE TABLE IF NOT EXISTS "meal_slot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" uuid NOT NULL REFERENCES "meal_plan"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "meal" "meal_type" NOT NULL,
  "time_available_minutes" integer,
  -- 'HH:MM' wall clock in the plan's timezone; null falls back to a per-meal default.
  "meal_time" text,
  "recipe_id" uuid REFERENCES "recipe"("id") ON DELETE SET NULL,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meal_slot_plan_date_meal_uidx" UNIQUE ("plan_id", "date", "meal")
);
CREATE INDEX IF NOT EXISTS "meal_slot_plan_idx" ON "meal_slot" ("plan_id");

CREATE TABLE IF NOT EXISTS "pantry_staple" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  -- Lowercased/trimmed matching key; the unique constraint dedupes case variants.
  "normalized_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pantry_staple_user_name_uidx" UNIQUE ("user_id", "normalized_name")
);

CREATE TABLE IF NOT EXISTS "plan_on_hand_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" uuid NOT NULL REFERENCES "meal_plan"("id") ON DELETE CASCADE,
  -- Null means available for the whole plan rather than one day.
  "date" date,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "plan_on_hand_plan_idx" ON "plan_on_hand_item" ("plan_id");

CREATE TABLE IF NOT EXISTS "grocery_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" uuid NOT NULL REFERENCES "meal_plan"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  -- Amounts stay as written per recipe; they are free text and never summed.
  "detail" text,
  "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "checked" boolean NOT NULL DEFAULT false,
  "added_manually" boolean NOT NULL DEFAULT false,
  -- Kept as a row rather than dropped, so a bad pantry match can be un-hidden.
  "covered_by_pantry" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "grocery_item_plan_idx" ON "grocery_item" ("plan_id");

CREATE TABLE IF NOT EXISTS "made_it" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "recipe_id" uuid NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "media_id" uuid NOT NULL REFERENCES "media_asset"("id") ON DELETE CASCADE,
  "cook_session_id" uuid REFERENCES "cook_session"("id") ON DELETE SET NULL,
  "moderation_status" "moderation_status" NOT NULL DEFAULT 'approved',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "made_it_recipe_idx" ON "made_it" ("recipe_id", "moderation_status");
CREATE INDEX IF NOT EXISTS "made_it_user_idx" ON "made_it" ("user_id");

-- Generalise scheduled events so they can belong to a meal slot.
-- Existing cook rows keep their session, so there is nothing to backfill.
ALTER TABLE "scheduled_step_event" ALTER COLUMN "cook_session_id" DROP NOT NULL;
ALTER TABLE "scheduled_step_event" ALTER COLUMN "step_index" DROP NOT NULL;
ALTER TABLE "scheduled_step_event"
  ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "meal_slot_id" uuid REFERENCES "meal_slot"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "scheduled_step_event_meal_slot_idx"
  ON "scheduled_step_event" ("meal_slot_id");
