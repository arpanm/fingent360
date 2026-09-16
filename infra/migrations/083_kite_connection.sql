CREATE TABLE broker_kite_connections (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('pending','connected','revoked','expired')),
 version integer NOT NULL DEFAULT 1,
 state_hash text UNIQUE,
 pending_until timestamptz,
 encrypted_token jsonb,
 connected_at timestamptz,
 expires_at timestamptz,
 last_fetched_at timestamptz,
 permission_reference text NOT NULL,
 CHECK ((state='connected') = (encrypted_token IS NOT NULL))
);
CREATE TABLE broker_kite_captures (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 preview_id uuid REFERENCES app_holdings_previews(id) ON DELETE SET NULL,
 encrypted_payload jsonb NOT NULL,source_hash text NOT NULL,retrieved_at timestamptz NOT NULL
);
CREATE INDEX broker_kite_capture_owner ON broker_kite_captures(user_id,retrieved_at DESC);
CREATE TABLE broker_kite_events(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,action text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now());
