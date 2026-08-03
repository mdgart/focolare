-- Densities looked up for ingredients the hand-written table doesn't cover.
-- Cached because the answer for "gochujang" is the same for everyone, and a
-- model call per page view would be slow and pointless.
CREATE TABLE IF NOT EXISTS "ingredient_density" (
  "normalized_name" text PRIMARY KEY,
  "grams_per_cup" integer NOT NULL,
  "liquid" boolean NOT NULL DEFAULT false,
  /** 'ai' for an estimate; kept so estimates can be labelled as such. */
  "source" text NOT NULL DEFAULT 'ai',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
