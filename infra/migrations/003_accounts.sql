CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_scheme text NOT NULL DEFAULT 'scrypt-131072-8-1-v1',
  consent_version text NOT NULL DEFAULT 'account-storage-v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions(user_id);
CREATE TABLE IF NOT EXISTS app_watchlists (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  indicators text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_login_limits (
  username text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS app_login_limits_expiry ON app_login_limits(reset_at);
