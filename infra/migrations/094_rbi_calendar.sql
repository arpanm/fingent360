CREATE TABLE rbi_calendar_rights (id boolean PRIMARY KEY DEFAULT true CHECK(id), evidence text NOT NULL CHECK(length(evidence) BETWEEN 20 AND 2000), recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rbi_calendar_editions(hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'), retrieved_at timestamptz NOT NULL, rights_evidence text NOT NULL, data jsonb NOT NULL);
CREATE TRIGGER rbi_calendar_immutable BEFORE UPDATE OR DELETE ON rbi_calendar_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
INSERT INTO research_auto_schedules(source_id,enabled) VALUES('rbi-mpc-calendar',false) ON CONFLICT DO NOTHING;
