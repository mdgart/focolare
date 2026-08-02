-- A paused cook timer: the row stays pending so the countdown can be picked
-- back up, but it must not fire while it's holding. Non-null means paused, and
-- carries what was left at the moment the cook stopped it.
ALTER TABLE "scheduled_step_event"
  ADD COLUMN IF NOT EXISTS "paused_remaining_seconds" integer;
