CREATE TABLE eia_spot_gate(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,rights_evidence text NOT NULL DEFAULT '');
INSERT INTO eia_spot_gate(id) VALUES(true);
CREATE TABLE eia_spot_sources(id uuid PRIMARY KEY,actor_id text NOT NULL,fingerprint text NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE eia_spot_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,source_id uuid NOT NULL REFERENCES eia_spot_sources(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TRIGGER eia_spot_sources_immutable BEFORE UPDATE OR DELETE ON eia_spot_sources FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER eia_spot_reviews_immutable BEFORE UPDATE OR DELETE ON eia_spot_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
INSERT INTO research_auto_schedules(source_id,enabled) VALUES('eia-daily-spot',false) ON CONFLICT DO NOTHING;
