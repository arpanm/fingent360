CREATE TABLE IF NOT EXISTS feedback_reports (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL CHECK (length(token_hash)=64),
 payload_hash text NOT NULL CHECK (length(payload_hash)=64),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','resolved')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 received_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 deleted_at timestamptz,
 text text,
 context jsonb,
 image_meta jsonb,
 image_bytes bytea,
 audio_meta jsonb,
 audio_bytes bytea,
 CHECK(octet_length(image_bytes)<=2000000),
 CHECK(octet_length(audio_bytes)<=4000000)
);
CREATE INDEX IF NOT EXISTS feedback_reports_inbox ON feedback_reports(received_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS feedback_reports_expiration ON feedback_reports(expires_at) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS feedback_rate_limits (
 bucket text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 count integer NOT NULL CHECK(count>=0)
);
CREATE TABLE IF NOT EXISTS feedback_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 report_id uuid NOT NULL REFERENCES feedback_reports(id),
 actor text NOT NULL,
 action text NOT NULL,
 version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
