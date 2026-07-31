CREATE TABLE IF NOT EXISTS dota_updates (
  id integer PRIMARY KEY NOT NULL,
  source text NOT NULL,
  current_patch text NOT NULL,
  status text DEFAULT 'unknown' NOT NULL,
  payload text DEFAULT '{}' NOT NULL,
  checked_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  source_updated_at integer
);
