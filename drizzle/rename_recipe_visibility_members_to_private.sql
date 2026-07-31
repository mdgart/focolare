-- The initial schema shipped `recipe_visibility` with a 'members' value that is now
-- called 'private'. Guarded so this is safe to re-run on a database that has already
-- been renamed — the deploy step (npm run db:migrate) replays every file.
-- PostgreSQL 10+
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'recipe_visibility'
      AND e.enumlabel = 'members'
  ) THEN
    ALTER TYPE "recipe_visibility" RENAME VALUE 'members' TO 'private';
  END IF;
END $$;
