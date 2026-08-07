-- Let a channel outlive the person who made it.
--
-- Deleting an account used to cascade user → channel → recipe, so leaving took
-- every published recipe with it, including ones other people had saved. The
-- owner is now nullable and detaches instead: the person and everything
-- personal to them is destroyed, while work others depend on stays up under an
-- anonymous name.
ALTER TABLE "channel" ALTER COLUMN "owner_user_id" DROP NOT NULL;

ALTER TABLE "channel" DROP CONSTRAINT IF EXISTS "channel_owner_user_id_user_id_fk";

ALTER TABLE "channel"
  ADD CONSTRAINT "channel_owner_user_id_user_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
