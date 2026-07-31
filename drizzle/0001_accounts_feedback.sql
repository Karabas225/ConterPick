CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  email text,
  phone text,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'user' NOT NULL,
  created_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users (phone);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  created_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS draft_events (
  id text PRIMARY KEY NOT NULL,
  user_id text,
  anonymous_id text,
  target_role integer NOT NULL,
  allies_json text NOT NULL,
  enemies_json text NOT NULL,
  recommendations_json text NOT NULL,
  created_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS draft_events_user_idx ON draft_events (user_id, created_at);

CREATE TABLE IF NOT EXISTS pick_feedback (
  id text PRIMARY KEY NOT NULL,
  event_id text,
  user_id text,
  hero_id integer NOT NULL,
  used integer NOT NULL,
  outcome text,
  rating integer,
  note text,
  context_json text NOT NULL,
  created_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS pick_feedback_created_idx ON pick_feedback (created_at);
CREATE INDEX IF NOT EXISTS pick_feedback_hero_idx ON pick_feedback (hero_id, used);

CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY NOT NULL,
  user_id text,
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  closed_by text,
  closed_at integer,
  created_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status, updated_at);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets (user_id, created_at);
