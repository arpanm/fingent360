CREATE TABLE IF NOT EXISTS app_holdings (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 0 CHECK(version >= 0)
);
CREATE TABLE IF NOT EXISTS app_holdings_revisions (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,version)
);
CREATE TABLE IF NOT EXISTS app_holdings_previews (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expected_version integer NOT NULL,
 payload jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 confirmed_version integer
);
CREATE INDEX IF NOT EXISTS app_holdings_previews_owner ON app_holdings_previews(user_id);
