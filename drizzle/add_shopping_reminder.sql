-- An optional nudge the evening before: what to buy for tomorrow's planned meals.
ALTER TYPE "scheduled_event_kind" ADD VALUE IF NOT EXISTS 'shopping_reminder';
