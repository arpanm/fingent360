CREATE TABLE commodity_sources(id uuid PRIMARY KEY,actor_id text NOT NULL,fingerprint text NOT NULL,body_hash text NOT NULL,receipt jsonb,error text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK((receipt IS NULL)<>(error IS NULL)));
CREATE TABLE commodity_reviews(seq bigserial PRIMARY KEY,request_id uuid NOT NULL UNIQUE,source_id uuid NOT NULL REFERENCES commodity_sources(id),actor_id text NOT NULL,payload jsonb NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE commodity_gate(id boolean PRIMARY KEY DEFAULT true CHECK(id),source_id uuid REFERENCES commodity_sources(id));
INSERT INTO commodity_gate(id) VALUES(true);
ALTER TABLE commodity_gate ADD COLUMN rights_evidence text;
INSERT INTO research_auto_schedules(source_id,enabled,interval_minutes,next_at,last_status,message) VALUES('commodity-benchmarks',false,1440,clock_timestamp(),'never','World Bank metals draft capture is disabled until source rights are recorded.') ON CONFLICT(source_id) DO NOTHING;
