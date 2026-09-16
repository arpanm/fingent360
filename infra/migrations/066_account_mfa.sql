CREATE TABLE app_account_mfa (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 encrypted_secret jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 expires_at timestamptz,
 last_step bigint NOT NULL DEFAULT -1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((enabled AND expires_at IS NULL) OR (NOT enabled AND expires_at IS NOT NULL))
);
CREATE TABLE app_mfa_limits (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 attempts integer NOT NULL,
 reset_at timestamptz NOT NULL
);
