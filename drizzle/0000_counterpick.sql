CREATE TABLE IF NOT EXISTS page_cache (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  cache_key text NOT NULL,
  source_path text NOT NULL,
  payload text NOT NULL,
  patch text DEFAULT '' NOT NULL,
  fetched_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS page_cache_key_idx ON page_cache (cache_key);
CREATE TABLE IF NOT EXISTS meta_stats (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  hero_id integer NOT NULL,
  role integer NOT NULL,
  matches integer NOT NULL,
  win_rate integer NOT NULL,
  rating integer NOT NULL,
  patch text NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS pair_stats (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  hero_id integer NOT NULL,
  other_hero_id integer NOT NULL,
  relation text NOT NULL,
  matches integer NOT NULL,
  advantage integer NOT NULL,
  patch text NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS build_cache (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  hero_id integer NOT NULL,
  role integer NOT NULL,
  enemy_hash text NOT NULL,
  payload text NOT NULL,
  sample integer NOT NULL,
  patch text NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
