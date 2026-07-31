CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY NOT NULL,
  value text DEFAULT '{}' NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
