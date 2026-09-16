CREATE TABLE whatsapp_connections(user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,request_id uuid NOT NULL,phone_hash text NOT NULL UNIQUE,payload jsonb NOT NULL,state text NOT NULL CHECK(state IN('pending','verified','disabled')),code_hash text,expires_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE whatsapp_outbox(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,item_id text NOT NULL,payload jsonb NOT NULL,state text NOT NULL CHECK(state IN('queued','sending','accepted','delivered','read','failed','uncertain','cancelled')),provider_id text UNIQUE,dispatch_count integer NOT NULL DEFAULT 0 CHECK(dispatch_count BETWEEN 0 AND 3),detail text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX whatsapp_outbox_queue ON whatsapp_outbox(state,created_at);
CREATE TABLE whatsapp_webhook_receipts(hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE whatsapp_verification_attempts (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX whatsapp_verification_attempts_owner_time ON whatsapp_verification_attempts(user_id,created_at);
