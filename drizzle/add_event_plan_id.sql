-- Shopping reminders belong to a plan and a date, not to a meal slot or a cook
-- session. The FK cascades, so deleting a plan takes its reminders with it.
ALTER TABLE "scheduled_step_event"
  ADD COLUMN IF NOT EXISTS "plan_id" uuid REFERENCES "meal_plan"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "scheduled_step_event_plan_idx"
  ON "scheduled_step_event" ("plan_id");
