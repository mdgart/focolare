-- Adds the 'meal_reminder' value to scheduled_event_kind.
--
-- Deliberately its own file: the migration runner sends a multi-statement file
-- as one implicitly transactional query, and older PostgreSQL majors refuse
-- ALTER TYPE ... ADD VALUE inside a transaction block. Alone, this runs as a
-- single statement and is safe everywhere.
--
-- Sorts after add_meal_planner.sql, though the order does not matter: nothing
-- in the SQL uses the new value, only the application does.
ALTER TYPE "scheduled_event_kind" ADD VALUE IF NOT EXISTS 'meal_reminder';
