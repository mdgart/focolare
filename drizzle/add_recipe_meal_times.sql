-- Which occasions a recipe is for: breakfast, brunch, dinner, dessert and so on.
-- Empty means nobody said, which is treated as "suits any meal" rather than none.
ALTER TABLE "recipe" ADD COLUMN IF NOT EXISTS "meal_times" jsonb NOT NULL DEFAULT '[]'::jsonb;
