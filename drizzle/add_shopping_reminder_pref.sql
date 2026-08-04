-- Off by default: an unasked-for notification about shopping is spam.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "notify_shopping_reminder" boolean NOT NULL DEFAULT false;
