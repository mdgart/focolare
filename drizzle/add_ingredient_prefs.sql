-- How one cook wants to read one recipe: scaling, measuring system, and any
-- substitutions they've chosen. Applied on the recipe page and in cook mode
-- alike, so what you set up while reading is what you see while cooking.
CREATE TABLE IF NOT EXISTS "recipe_ingredient_pref" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "recipe_id" uuid NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "scale_percent" integer NOT NULL DEFAULT 100,
  "unit_system" text NOT NULL DEFAULT 'recipe',
  "substitutions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "recipe_id")
);
