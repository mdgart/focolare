-- Credit for imported stock photos. Null for uploads and AI-generated images.
ALTER TABLE "media_asset"
  ADD COLUMN IF NOT EXISTS "attribution" text,
  ADD COLUMN IF NOT EXISTS "attribution_url" text;
