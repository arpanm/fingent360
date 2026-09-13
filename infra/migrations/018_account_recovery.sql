CREATE TABLE app_account_recovery (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE TABLE app_recovery_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL CHECK (attempts > 0),
  reset_at timestamptz NOT NULL
);
CREATE INDEX app_recovery_limits_expiry ON app_recovery_limits(reset_at);
