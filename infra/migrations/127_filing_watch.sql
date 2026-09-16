CREATE TABLE filing_watch_gate(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,source_ids jsonb NOT NULL DEFAULT '["ASMS"]',rights_evidence text NOT NULL DEFAULT '',rights_hash text NOT NULL DEFAULT '',actor_id text,version integer NOT NULL DEFAULT 1,cursor integer NOT NULL DEFAULT 0);
INSERT INTO filing_watch_gate(id) VALUES(true);
CREATE TABLE filing_watch_attempts(id uuid PRIMARY KEY,source_id text NOT NULL,source_url text NOT NULL,rights_hash text NOT NULL,gate_version integer NOT NULL,status text NOT NULL CHECK(status IN('draft','unchanged','quarantine','unavailable')),edition_id uuid REFERENCES equity_editions(id),body_hash text,message text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX filing_watch_attempts_lookup ON filing_watch_attempts(source_id,body_hash,rights_hash);
CREATE TRIGGER filing_watch_attempts_immutable BEFORE UPDATE OR DELETE ON filing_watch_attempts FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
INSERT INTO research_auto_schedules(source_id,enabled) VALUES('equity-filing-watch',false) ON CONFLICT DO NOTHING;
