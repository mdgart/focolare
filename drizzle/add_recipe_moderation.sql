-- Safety review state for user-submitted recipes.
DO $$ BEGIN
  CREATE TYPE "moderation_status" AS ENUM ('approved', 'flagged', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "recipe"
  ADD COLUMN IF NOT EXISTS "moderation_status" "moderation_status" NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "moderation_flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "moderated_at" timestamptz,
  -- BCP-47 language the recipe is written in; drives the "translate" affordance.
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS "recipe_moderation_idx" ON "recipe" USING btree ("moderation_status");
