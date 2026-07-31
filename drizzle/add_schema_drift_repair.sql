-- Repairs drift between drizzle/0000_init.sql and src/db/schema.ts.
--
-- The init file was generated early, and later schema changes were applied with
-- `drizzle-kit push` instead of a generated migration. Development databases
-- picked those up silently; any database built from these files did not — which
-- is how a fresh production database ended up without tags, cover images, or
-- notification preferences.
--
-- Everything here is guarded, so it is a no-op on databases that already have it.

-- Ingredient measure system ---------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "ingredient_measure_system" AS ENUM ('metric', 'us');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "recipe"
  ADD COLUMN IF NOT EXISTS "ingredient_measure_system" "ingredient_measure_system"
    NOT NULL DEFAULT 'metric';

-- Media on recipes and steps --------------------------------------------------
ALTER TABLE "recipe" ADD COLUMN IF NOT EXISTS "cover_media_id" uuid;
ALTER TABLE "recipe_step" ADD COLUMN IF NOT EXISTS "image_media_id" uuid;

DO $$ BEGIN
  ALTER TABLE "recipe" ADD CONSTRAINT "recipe_cover_media_id_media_asset_id_fk"
    FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recipe_step" ADD CONSTRAINT "recipe_step_image_media_id_media_asset_id_fk"
    FOREIGN KEY ("image_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "recipe_cover_media_idx" ON "recipe" ("cover_media_id");
CREATE INDEX IF NOT EXISTS "recipe_step_image_media_idx" ON "recipe_step" ("image_media_id");

-- User-proposed taxonomy ------------------------------------------------------
ALTER TABLE "taxonomy_category" ADD COLUMN IF NOT EXISTS "proposer_user_id" text;
ALTER TABLE "taxonomy_suggestion" ADD COLUMN IF NOT EXISTS "placeholder_category_id" uuid;

DO $$ BEGIN
  ALTER TABLE "taxonomy_category" ADD CONSTRAINT "taxonomy_category_proposer_user_id_user_id_fk"
    FOREIGN KEY ("proposer_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "taxonomy_suggestion" ADD CONSTRAINT "taxonomy_suggestion_placeholder_category_id_taxonomy_category_i"
    FOREIGN KEY ("placeholder_category_id") REFERENCES "taxonomy_category"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "taxonomy_category_proposer_idx" ON "taxonomy_category" ("proposer_user_id");

-- Cook-timer contact preferences ----------------------------------------------
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "phone_e164" text,
  ADD COLUMN IF NOT EXISTS "notify_cook_timer_email" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notify_cook_timer_sms" boolean NOT NULL DEFAULT false;

-- Tags ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "recipe_tag" (
  "recipe_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  CONSTRAINT "recipe_tag_recipe_id_tag_id_pk" PRIMARY KEY ("recipe_id", "tag_id")
);

DO $$ BEGIN
  ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk"
    FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk"
    FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "recipe_tag_tag_idx" ON "recipe_tag" ("tag_id");
