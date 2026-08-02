-- How many people a recipe makes. Optional: plenty of recipes never say, and a
-- guessed number would be worse than none once quantities are scaled off it.
ALTER TABLE "recipe" ADD COLUMN IF NOT EXISTS "servings" integer;
